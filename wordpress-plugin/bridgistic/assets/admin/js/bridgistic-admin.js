/**
 * Bridgistic admin UI. Vanilla JS, no dependencies.
 *
 * Talks to wp_ajax_* endpoints defined in class-bridgistic-admin-actions.php.
 * Every request carries the bridgistic_admin nonce. Secrets returned by the
 * create/rotate endpoints live only in DOM nodes the user explicitly reveals;
 * they are never persisted client-side.
 */
( function () {
	'use strict';

	if ( typeof window.bridgisticAdmin === 'undefined' ) {
		return;
	}

	var cfg = window.bridgisticAdmin;
	var i18n = cfg.i18n || {};

	// ---- tiny helpers ---------------------------------------------------------

	function $( sel, root ) {
		return ( root || document ).querySelector( sel );
	}

	function $$( sel, root ) {
		return Array.prototype.slice.call( ( root || document ).querySelectorAll( sel ) );
	}

	function toast( message, kind ) {
		var host = $( '#bridgistic-toasts' );
		if ( ! host ) {
			return;
		}
		var el = document.createElement( 'div' );
		el.className = 'bridgistic-toast' + ( kind ? ' is-' + kind : '' );
		el.textContent = message;
		host.appendChild( el );
		window.setTimeout( function () {
			el.classList.add( 'is-leaving' );
			window.setTimeout( function () {
				el.remove();
			}, 220 );
		}, 3500 );
	}

	function post( action, fields ) {
		var body = new FormData();
		body.append( 'action', action );
		body.append( 'nonce', cfg.nonce );
		Object.keys( fields || {} ).forEach( function ( key ) {
			body.append( key, fields[ key ] );
		} );
		return window
			.fetch( cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: body } )
			.then( function ( res ) {
				return res.json();
			} )
			.then( function ( json ) {
				if ( ! json || json.success !== true ) {
					var message = json && json.data && json.data.message ? json.data.message : i18n.error || 'Error';
					throw new Error( message );
				}
				return json.data;
			} );
	}

	function copyText( text ) {
		if ( navigator.clipboard && window.isSecureContext ) {
			return navigator.clipboard.writeText( text );
		}
		return new Promise( function ( resolve, reject ) {
			var area = document.createElement( 'textarea' );
			area.value = text;
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild( area );
			area.select();
			try {
				document.execCommand( 'copy' );
				resolve();
			} catch ( err ) {
				reject( err );
			} finally {
				area.remove();
			}
		} );
	}

	function downloadJson( filename, text ) {
		var blob = new Blob( [ text ], { type: 'application/json' } );
		var url = URL.createObjectURL( blob );
		var link = document.createElement( 'a' );
		link.href = url;
		link.download = filename;
		document.body.appendChild( link );
		link.click();
		link.remove();
		URL.revokeObjectURL( url );
	}

	function busy( button, isBusy ) {
		if ( ! button ) {
			return;
		}
		button.disabled = isBusy;
		if ( isBusy ) {
			button.dataset.label = button.textContent;
			button.textContent = i18n.working || 'Working…';
		} else if ( button.dataset.label ) {
			button.textContent = button.dataset.label;
		}
	}

	// ---- global: theme toggle ---------------------------------------------------

	var themeToggle = $( '#bridgistic-theme-toggle' );
	if ( themeToggle ) {
		themeToggle.addEventListener( 'click', function () {
			var root = document.documentElement;
			var current = root.getAttribute( 'data-bridgistic-theme' );
			var osDark = window.matchMedia && window.matchMedia( '(prefers-color-scheme: dark)' ).matches;
			var effective = current || ( osDark ? 'dark' : 'light' );
			var next = effective === 'light' ? 'dark' : 'light';
			root.setAttribute( 'data-bridgistic-theme', next );
			try {
				window.localStorage.setItem( 'bridgistic-theme', next );
			} catch ( err ) {
				/* storage unavailable — theme just won't persist */
			}
		} );
	}

	// ---- global: copy buttons ----------------------------------------------------

	document.addEventListener( 'click', function ( event ) {
		var button = event.target.closest( '[data-copy-target]' );
		if ( ! button ) {
			return;
		}
		var node = document.getElementById( button.getAttribute( 'data-copy-target' ) );
		if ( ! node ) {
			return;
		}
		copyText( node.textContent.trim() ).then(
			function () {
				toast( i18n.copied || 'Copied', 'success' );
			},
			function () {
				toast( i18n.copyFailed || 'Copy failed', 'error' );
			}
		);
	} );

	// ---- global: confirm forms (revoke / delete) -----------------------------------

	document.addEventListener( 'submit', function ( event ) {
		var form = event.target.closest( 'form[data-confirm]' );
		if ( ! form ) {
			return;
		}
		var kind = form.getAttribute( 'data-confirm' );
		var message = kind === 'delete' ? i18n.confirmDelete : i18n.confirmRevoke;
		if ( ! window.confirm( message || 'Are you sure?' ) ) {
			event.preventDefault();
		}
	} );

	// ---- global: log detail toggles ---------------------------------------------------

	document.addEventListener( 'click', function ( event ) {
		var button = event.target.closest( '[data-log-toggle]' );
		if ( ! button ) {
			return;
		}
		var row = document.getElementById( button.getAttribute( 'data-log-toggle' ) );
		if ( row ) {
			row.hidden = ! row.hidden;
		}
	} );

	// ---- Claude Setup wizard ------------------------------------------------------------

	var setup = $( '#bridgistic-setup' );
	if ( setup ) {
		var state = {
			connection: 'extension',
			preset: 'read_only',
			configs: null,
			keyId: null,
			connectSince: null,
		};

		var goToStep = function ( step ) {
			setup.dataset.step = String( step );
			$$( '[data-step-panel]', setup ).forEach( function ( panel ) {
				var num = parseInt( panel.getAttribute( 'data-step-panel' ), 10 );
				panel.classList.toggle( 'is-current', num === step );
				panel.classList.toggle( 'is-done', num < step );
			} );
			var active = $( '[data-step-panel="' + step + '"]', setup );
			if ( active && active.scrollIntoView ) {
				active.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
			}
			if ( 5 === step ) {
				startClientPoll();
			} else {
				stopClientPoll();
			}
		};

		setup.addEventListener( 'click', function ( event ) {
			var next = event.target.closest( '[data-step-next]' );
			if ( next ) {
				var target = parseInt( next.getAttribute( 'data-step-next' ), 10 );
				// Guard: cannot pass step 3 without a key.
				if ( target > 3 && ! state.keyId ) {
					toast( i18n.error || 'Create a key first', 'error' );
					goToStep( 3 );
					return;
				}
				goToStep( target );
			}
			var back = event.target.closest( '[data-step-back]' );
			if ( back ) {
				goToStep( parseInt( back.getAttribute( 'data-step-back' ), 10 ) );
			}
		} );

		// Step 1: connection choice.
		$$( '[data-connection]', setup ).forEach( function ( choice ) {
			choice.addEventListener( 'click', function () {
				$$( '[data-connection]', setup ).forEach( function ( other ) {
					other.classList.remove( 'is-selected' );
				} );
				choice.classList.add( 'is-selected' );
				state.connection = choice.getAttribute( 'data-connection' );
				syncConfigTabs();
			} );
		} );

		// Step 2: preset choice + developer warning.
		var devWarning = $( '[data-dev-warning]', setup );
		$$( '[data-preset]', setup ).forEach( function ( choice ) {
			choice.addEventListener( 'click', function () {
				var risky = choice.getAttribute( 'data-risky' ) === '1';
				if ( risky && ! window.confirm( i18n.confirmDevMode || 'Enable developer mode?' ) ) {
					return;
				}
				$$( '[data-preset]', setup ).forEach( function ( other ) {
					other.classList.remove( 'is-selected' );
				} );
				choice.classList.add( 'is-selected' );
				state.preset = choice.getAttribute( 'data-preset' );
				if ( devWarning ) {
					devWarning.hidden = ! risky;
				}
			} );
		} );

		// Step 3: create key.
		var createButton = $( '#bridgistic-create-key' );
		if ( createButton ) {
			createButton.addEventListener( 'click', function () {
				busy( createButton, true );
				post( 'bridgistic_setup_create_key', {
					preset: state.preset,
					label: ( $( '#bridgistic-key-label' ) || {} ).value || '',
				} )
					.then( function ( data ) {
						state.keyId = data.keyId;
						state.configs = data.configs;
						state.connectSince = data.connectSince;
						$( '#bridgistic-new-key-id' ).textContent = data.keyId;
						$( '#bridgistic-new-key-secret' ).textContent = data.secret;
						$( '#bridgistic-key-result' ).hidden = false;
						fillConfigs();
						toast( i18n.secretOnce || 'Secret shown once — copy it now', 'success' );
					} )
					.catch( function ( err ) {
						toast( err.message, 'error' );
					} )
					.finally( function () {
						busy( createButton, false );
					} );
			} );
		}

		// Step 4: config tabs + copy/download.
		var fillConfigs = function () {
			if ( ! state.configs ) {
				return;
			}
			[ 'desktop', 'code', 'cli', 'codex', 'gemini' ].forEach( function ( key ) {
				var node = $( '#bridgistic-config-' + key );
				if ( node && state.configs[ key ] ) {
					node.textContent = state.configs[ key ];
				}
			} );
			var ext = state.configs.extensionFields;
			if ( ext ) {
				if ( $( '#bridgistic-ext-site-url' ) ) {
					$( '#bridgistic-ext-site-url' ).textContent = ext.siteUrl;
				}
				if ( $( '#bridgistic-ext-key-id' ) ) {
					$( '#bridgistic-ext-key-id' ).textContent = ext.keyId;
				}
				if ( $( '#bridgistic-ext-secret' ) ) {
					$( '#bridgistic-ext-secret' ).textContent = ext.secret;
				}
			}
		};

		var showConfigTab = function ( name ) {
			$$( '[data-config-tab]', setup ).forEach( function ( tab ) {
				tab.classList.toggle( 'is-active', tab.getAttribute( 'data-config-tab' ) === name );
			} );
			$$( '[data-config-panel]', setup ).forEach( function ( panel ) {
				panel.hidden = panel.getAttribute( 'data-config-panel' ) !== name;
			} );
			// The extension panel has its own per-field copy buttons and its
			// own download-the-extension action; the generic JSON copy/download
			// footer buttons below don't apply to it (there's no single JSON
			// blob to copy for a three-field paste-in prompt).
			var isExtension = 'extension' === name;
			[ '#bridgistic-copy-config', '#bridgistic-download-config' ].forEach( function ( sel ) {
				var btn = $( sel );
				if ( btn ) {
					btn.hidden = isExtension;
				}
			} );
		};

		var syncConfigTabs = function () {
			if ( state.connection === 'code' ) {
				showConfigTab( 'code' );
			} else if ( state.connection === 'codex' ) {
				showConfigTab( 'codex' );
			} else if ( state.connection === 'gemini' ) {
				showConfigTab( 'gemini' );
			} else if ( state.connection === 'manual' ) {
				showConfigTab( 'cli' );
			} else if ( state.connection === 'extension' ) {
				showConfigTab( 'extension' );
			} else {
				showConfigTab( 'desktop' );
			}
		};

		$$( '[data-config-tab]', setup ).forEach( function ( tab ) {
			tab.addEventListener( 'click', function () {
				showConfigTab( tab.getAttribute( 'data-config-tab' ) );
			} );
		} );

		var activeConfigText = function () {
			var panel = $$( '[data-config-panel]', setup ).filter( function ( p ) {
				return ! p.hidden;
			} )[ 0 ];
			var pre = panel ? $( '.bridgistic-code[id]', panel ) : null;
			return pre ? pre.textContent : '';
		};

		var copyConfig = $( '#bridgistic-copy-config' );
		if ( copyConfig ) {
			copyConfig.addEventListener( 'click', function () {
				copyText( activeConfigText() ).then( function () {
					toast( i18n.copied || 'Copied', 'success' );
				} );
			} );
		}

		var downloadConfig = $( '#bridgistic-download-config' );
		if ( downloadConfig ) {
			downloadConfig.addEventListener( 'click', function () {
				if ( ! state.configs ) {
					return;
				}
				var downloadMap = {
					code: [ 'claude_code_config.json', state.configs.code ],
					codex: [ 'config.toml', state.configs.codex ],
					gemini: [ 'settings.json', state.configs.gemini ]
				};
				var picked = downloadMap[ state.connection ] || [ 'claude_desktop_config.json', state.configs.desktop ];
				downloadJson( picked[ 0 ], picked[ 1 ] );
			} );
		}

		// Step 5: test connection.
		var testButton = $( '#bridgistic-test-connection' );
		if ( testButton ) {
			testButton.addEventListener( 'click', function () {
				var out = $( '#bridgistic-test-result' );
				busy( testButton, true );
				out.hidden = false;
				out.innerHTML = '<div class="bridgistic-callout is-info"><p>' + ( i18n.testRunning || 'Testing…' ) + '</p></div>';
				post( 'bridgistic_test_connection', {} )
					.then( function ( data ) {
						var kind = data.ok ? 'is-success' : 'is-danger';
						var detail = data.hmac ? data.hmac.message : '';
						out.innerHTML =
							'<div class="bridgistic-callout ' + kind + '"><p></p></div>';
						out.querySelector( 'p' ).textContent = data.message + ' ' + detail;
					} )
					.catch( function ( err ) {
						out.innerHTML = '<div class="bridgistic-callout is-danger"><p></p></div>';
						out.querySelector( 'p' ).textContent = err.message;
					} )
					.finally( function () {
						busy( testButton, false );
					} );
			} );
		}

		// Step 5: client check — poll until the AI client makes its first real
		// request with this key, instead of making the user guess and go check
		// the Logs page themselves.
		var clientPollTimer = null;
		var clientPollCount = 0;
		var CLIENT_POLL_MAX = 40; // ~2.5 minutes at 4s intervals, then wait for manual "Check now".

		var renderClientStatus = function ( html ) {
			var out = $( '#bridgistic-client-status' );
			if ( out ) {
				out.innerHTML = html;
			}
		};

		var renderWaiting = function () {
			renderClientStatus(
				'<div class="bridgistic-callout is-info"><p>' +
					( i18n.clientWaiting || "Waiting for your AI client's first request…" ) +
					'</p></div>'
			);
		};

		var renderConnected = function () {
			renderClientStatus(
				'<div class="bridgistic-callout is-success"><p>' +
					( i18n.clientConnected || 'Connected — a real request just came in from your AI client.' ) +
					'</p></div>'
			);
		};

		var renderStillWaiting = function () {
			renderClientStatus(
				'<div class="bridgistic-callout is-info"><p>' +
					( i18n.clientStillWaiting || "Still waiting. That's normal if you haven't asked your AI assistant to do anything yet." ) +
					'</p><button type="button" class="bridgistic-button is-soft is-small" id="bridgistic-client-recheck">' +
					( i18n.checkNow || 'Check now' ) +
					'</button></div>'
			);
			var recheck = $( '#bridgistic-client-recheck' );
			if ( recheck ) {
				recheck.addEventListener( 'click', function () {
					clientPollCount = 0;
					renderWaiting();
					pollClientOnce();
				} );
			}
		};

		var pollClientOnce = function () {
			if ( ! state.keyId || ! state.connectSince ) {
				return;
			}
			post( 'bridgistic_poll_client_connected', { key_id: state.keyId, since: state.connectSince } )
				.then( function ( data ) {
					if ( data.connected ) {
						renderConnected();
						stopClientPoll();
						return;
					}
					clientPollCount++;
					if ( clientPollCount >= CLIENT_POLL_MAX ) {
						stopClientPoll();
						renderStillWaiting();
					}
				} )
				.catch( function () {
					// Transient network errors shouldn't stop the wizard; just try again next tick.
				} );
		};

		var startClientPoll = function () {
			if ( clientPollTimer || ! state.keyId ) {
				return;
			}
			clientPollCount = 0;
			renderWaiting();
			pollClientOnce();
			clientPollTimer = window.setInterval( pollClientOnce, 4000 );
		};

		var stopClientPoll = function () {
			if ( clientPollTimer ) {
				window.clearInterval( clientPollTimer );
				clientPollTimer = null;
			}
		};

		syncConfigTabs();
	}

	// ---- Keys page: rotate / get config / ajax revoke -------------------------------------

	document.addEventListener( 'click', function ( event ) {
		var rotate = event.target.closest( '[data-key-rotate]' );
		if ( rotate ) {
			if ( ! window.confirm( i18n.confirmRotate || 'Rotate secret?' ) ) {
				return;
			}
			busy( rotate, true );
			post( 'bridgistic_rotate_key', { key_id: rotate.getAttribute( 'data-key-rotate' ) } )
				.then( function ( data ) {
					var section = $( '#bridgistic-rotated-result' );
					$( '#bridgistic-rotated-key-id' ).textContent = data.keyId;
					$( '#bridgistic-rotated-key-secret' ).textContent = data.secret;
					section.hidden = false;
					section.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
					toast( i18n.secretOnce || 'Secret shown once', 'success' );
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
				} )
				.finally( function () {
					busy( rotate, false );
				} );
			return;
		}

		var getConfig = event.target.closest( '[data-key-config]' );
		if ( getConfig ) {
			busy( getConfig, true );
			var keyId = getConfig.getAttribute( 'data-key-config' );
			post( 'bridgistic_get_config', { key_id: keyId } )
				.then( function ( data ) {
					var section = $( '#bridgistic-key-config-result' );
					$( '#bridgistic-config-key-id' ).textContent = keyId;
					$( '#bridgistic-existing-config' ).textContent = data.configs.desktop;
					section.hidden = false;
					section.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
				} )
				.finally( function () {
					busy( getConfig, false );
				} );
		}
	} );

	// ---- Health page ----------------------------------------------------------------------

	var runHealth = $( '#bridgistic-run-health' );
	if ( runHealth ) {
		var report = null;

		var iconFor = function ( status ) {
			var map = { pass: 'M4 12.5 9.5 18 20 6.5', warn: 'M12 3 1.5 21h21L12 3zm0 7v5m0 3h.01', fail: 'M5 5l14 14M19 5 5 19', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14h.01M12 12v6' };
			return (
				'<svg class="bridgistic-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
				( map[ status ] || map.info ) +
				'"/></svg>'
			);
		};

		var badgeFor = function ( status ) {
			var label = { pass: 'Pass', warn: 'Warning', fail: 'Fail', info: 'Info' }[ status ] || status;
			var cls = { pass: 'is-pass', warn: 'is-warn', fail: 'is-fail', info: 'is-info' }[ status ] || 'is-muted';
			return '<span class="bridgistic-badge ' + cls + '">' + label + '</span>';
		};

		var renderChecks = function ( data ) {
			var grid = $( '#bridgistic-health-grid' );
			grid.innerHTML = '';
			data.checks.forEach( function ( check ) {
				var card = document.createElement( 'article' );
				card.className = 'bridgistic-card bridgistic-health-card is-' + check.status;
				var head = document.createElement( 'header' );
				head.innerHTML = iconFor( check.status ) + '<h3></h3>' + badgeFor( check.status );
				head.querySelector( 'h3' ).textContent = check.label;
				card.appendChild( head );
				var msg = document.createElement( 'p' );
				msg.textContent = check.message;
				card.appendChild( msg );
				if ( check.fix ) {
					var fix = document.createElement( 'span' );
					fix.className = 'bridgistic-fix';
					fix.textContent = '→ ' + check.fix;
					card.appendChild( fix );
				}
				grid.appendChild( card );
			} );

			// Score arc.
			var arc = $( '#bridgistic-score-arc' );
			var number = $( '#bridgistic-score-number' );
			var circumference = 326.7;
			if ( arc ) {
				arc.style.strokeDashoffset = String( circumference * ( 1 - data.score / 100 ) );
				arc.style.stroke = data.score >= 80 ? 'var(--bz-accent)' : data.score >= 50 ? 'var(--bz-warn)' : 'var(--bz-danger)';
			}
			if ( number ) {
				number.textContent = String( data.score );
			}
			var headline = $( '#bridgistic-health-headline' );
			var subline = $( '#bridgistic-health-subline' );
			if ( headline ) {
				headline.textContent =
					data.score >= 90 ? 'Everything looks healthy' : data.score >= 60 ? 'Mostly healthy — review the warnings' : 'Attention needed';
			}
			if ( subline ) {
				subline.textContent = 'Checked ' + data.checked_at;
			}
		};

		var run = function () {
			busy( runHealth, true );
			post( 'bridgistic_run_health', {} )
				.then( function ( data ) {
					report = data.report;
					renderChecks( data );
					$( '#bridgistic-copy-report' ).disabled = false;
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
				} )
				.finally( function () {
					busy( runHealth, false );
				} );
		};

		runHealth.addEventListener( 'click', run );

		var copyReport = $( '#bridgistic-copy-report' );
		if ( copyReport ) {
			copyReport.addEventListener( 'click', function () {
				if ( ! report ) {
					return;
				}
				copyText( JSON.stringify( report, null, 2 ) ).then( function () {
					toast( i18n.copied || 'Copied', 'success' );
				} );
			} );
		}

		// Auto-run on page open — skeletons are already painted.
		run();
	}

	// ---- Snapshots page -----------------------------------------------------------------------

	var createSnapshot = $( '#bridgistic-create-snapshot' );
	if ( createSnapshot ) {
		createSnapshot.addEventListener( 'click', function () {
			busy( createSnapshot, true );
			post( 'bridgistic_create_snapshot', {} )
				.then( function ( data ) {
					toast( data.message, 'success' );
					window.location.reload();
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
					busy( createSnapshot, false );
				} );
		} );
	}

	document.addEventListener( 'click', function ( event ) {
		var restore = event.target.closest( '[data-snapshot-restore]' );
		if ( restore ) {
			if ( ! window.confirm( i18n.confirmRestore || 'Restore snapshot?' ) ) {
				return;
			}
			busy( restore, true );
			post( 'bridgistic_restore_snapshot', { snapshot_id: restore.getAttribute( 'data-snapshot-restore' ) } )
				.then( function ( data ) {
					toast( data.message, 'success' );
					window.location.reload();
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
					busy( restore, false );
				} );
			return;
		}

		var remove = event.target.closest( '[data-snapshot-delete]' );
		if ( remove ) {
			if ( ! window.confirm( i18n.confirmDelete || 'Delete permanently?' ) ) {
				return;
			}
			busy( remove, true );
			post( 'bridgistic_delete_snapshot', { snapshot_id: remove.getAttribute( 'data-snapshot-delete' ) } )
				.then( function () {
					window.location.reload();
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
					busy( remove, false );
				} );
		}
	} );

	// ---- Playbooks page ---------------------------------------------------------------------------

	document.addEventListener( 'click', function ( event ) {
		var builtin = event.target.closest( '[data-playbook-run]' );
		if ( builtin ) {
			var slug = builtin.getAttribute( 'data-playbook-run' );
			var resultBox = $( '[data-playbook-result="' + slug + '"]' );
			busy( builtin, true );
			post( 'bridgistic_run_builtin_playbook', { playbook: slug } )
				.then( function ( data ) {
					if ( resultBox ) {
						resultBox.hidden = false;
						resultBox.textContent = data.message;
					}
					toast( i18n.done || 'Done', 'success' );
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
				} )
				.finally( function () {
					busy( builtin, false );
				} );
			return;
		}

		var saved = event.target.closest( '[data-saved-playbook-run]' );
		if ( saved ) {
			var savedSlug = saved.getAttribute( 'data-saved-playbook-run' );
			var dry = saved.getAttribute( 'data-dry' ) === '1';
			if ( ! dry && ! window.confirm( 'Run this playbook live? Writes go through the Guard (dry-run, approvals, snapshots).' ) ) {
				return;
			}
			var row = $( '[data-saved-playbook-result="' + savedSlug + '"]' );
			busy( saved, true );
			post( 'bridgistic_run_saved_playbook', { playbook: savedSlug, dry_run: dry ? '1' : '' } )
				.then( function ( data ) {
					if ( row ) {
						row.hidden = false;
						row.querySelector( 'pre' ).textContent = JSON.stringify( data, null, 2 );
					}
					toast( i18n.done || 'Done', data.status === 'ok' ? 'success' : undefined );
				} )
				.catch( function ( err ) {
					toast( err.message, 'error' );
				} )
				.finally( function () {
					busy( saved, false );
				} );
		}
	} );

	// ---- Export page: secret checkbox guard ----------------------------------------------------------

	var exportForm = $( '#bridgistic-export-form' );
	if ( exportForm ) {
		exportForm.addEventListener( 'submit', function ( event ) {
			var secretBox = $( 'input[name="include_secret"]', exportForm );
			if ( ! secretBox || ! secretBox.checked ) {
				return;
			}
			var keySelect = $( '#bridgistic-export-key', exportForm );
			var freshKey = secretBox.getAttribute( 'data-fresh-key' );
			if ( keySelect && freshKey && keySelect.value !== freshKey ) {
				event.preventDefault();
				toast( 'The secret is only available for key ' + freshKey + ' — select it or untick "embed secret".', 'error' );
				return;
			}
			if ( ! window.confirm( 'The package will contain your key secret. Never share it publicly. Continue?' ) ) {
				event.preventDefault();
			}
		} );
	}
} )();
