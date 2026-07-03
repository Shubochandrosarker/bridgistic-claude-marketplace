<?php
/**
 * Health / debug center: runs every connection-related diagnostic and
 * returns structured results the Health page and AJAX endpoint render.
 *
 * Each check: { id, label, status: pass|warn|fail|info, message, fix }.
 * The debug report is the same data — it never contains secrets.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic\Admin;

use Bridgistic\Security\KeyStore;
use Bridgistic\Security\Scopes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class HealthCheck {

	private const MIN_PHP = '8.0';
	private const MIN_WP  = '6.4';

	/**
	 * Run all checks.
	 *
	 * @return array{score:int,checks:array<int,array<string,string>>,checked_at:string}
	 */
	public static function run(): array {
		$checks = array();

		// Loopback probes power several checks; run them once.
		$probe = self::probe_rest();

		$checks[] = self::check_rest_api( $probe );
		$checks[] = self::check_namespace( $probe );
		$checks[] = self::check_waf( $probe );
		$checks[] = self::check_hmac();
		$checks[] = self::check_site_url();
		$checks[] = self::check_ssl();
		$checks[] = self::check_permalinks();
		$checks[] = self::check_php_version();
		$checks[] = self::check_wp_version();
		$checks[] = self::check_uploads_writable();
		$checks[] = self::check_sandbox_protected();
		$checks[] = self::check_table( 'bridgistic_audit', __( 'Audit log table', 'bridgistic' ) );
		$checks[] = self::check_table( 'bridgistic_approvals', __( 'Approval queue', 'bridgistic' ) );
		$checks[] = self::check_key_scopes();
		$checks[] = self::check_config_generated();
		$checks[] = self::check_time_drift();

		$earned   = 0.0;
		$possible = 0;
		foreach ( $checks as $c ) {
			if ( 'info' === $c['status'] ) {
				continue;
			}
			++$possible;
			if ( 'pass' === $c['status'] ) {
				$earned += 1.0;
			} elseif ( 'warn' === $c['status'] ) {
				$earned += 0.5;
			}
		}

		return array(
			'score'      => $possible ? (int) round( 100 * $earned / $possible ) : 0,
			'checks'     => $checks,
			'checked_at' => gmdate( 'Y-m-d H:i:s' ) . ' UTC',
		);
	}

	/**
	 * Secret-free debug report for support requests.
	 *
	 * @param array<string,mixed> $result Output of run().
	 * @return array<string,mixed>
	 */
	public static function debug_report( array $result ): array {
		global $wp_version;
		return array(
			'generated_at' => gmdate( 'c' ),
			'plugin'       => 'bridgistic ' . BRIDGISTIC_VERSION,
			'site_url'     => home_url(),
			'wordpress'    => $wp_version,
			'php'          => PHP_VERSION,
			'ssl'          => is_ssl(),
			'permalinks'   => (bool) get_option( 'permalink_structure' ),
			'multisite'    => is_multisite(),
			'keys'         => count( KeyStore::list_all() ),
			'score'        => $result['score'],
			'checks'       => $result['checks'],
		);
	}

	// ---- probes -------------------------------------------------------------

	/**
	 * One unsigned loopback request to the namespace root.
	 *
	 * @return array{code:int,body:string,json:mixed,error:string}
	 */
	private static function probe_rest(): array {
		$url = rest_url( BRIDGISTIC_REST_NAMESPACE . '/site-info' );
		$res = wp_remote_get(
			$url,
			array(
				'timeout'   => 10,
				'sslverify' => false, // Loopback self-request; many hosts have certs that don't match internally.
			)
		);

		if ( is_wp_error( $res ) ) {
			return array(
				'code'  => 0,
				'body'  => '',
				'json'  => null,
				'error' => $res->get_error_message(),
			);
		}

		$body = (string) wp_remote_retrieve_body( $res );
		return array(
			'code'  => (int) wp_remote_retrieve_response_code( $res ),
			'body'  => $body,
			'json'  => json_decode( $body, true ),
			'error' => '',
		);
	}

	// ---- individual checks ----------------------------------------------------

	/** @param array<string,mixed> $probe */
	private static function check_rest_api( array $probe ): array {
		if ( $probe['error'] ) {
			return self::result( 'rest_api', __( 'REST API', 'bridgistic' ), 'fail',
				sprintf( __( 'The site cannot reach its own REST API: %s', 'bridgistic' ), $probe['error'] ),
				__( 'Ask your host whether loopback HTTP requests are blocked. Claude connects from outside, so this may still work — test from Claude to confirm.', 'bridgistic' )
			);
		}
		if ( 404 === $probe['code'] && null === $probe['json'] ) {
			return self::result( 'rest_api', __( 'REST API', 'bridgistic' ), 'fail',
				__( 'The REST API returned 404 with no JSON — it looks disabled or rewritten away.', 'bridgistic' ),
				__( 'Enable pretty permalinks (Settings → Permalinks) and make sure no plugin disables the REST API.', 'bridgistic' )
			);
		}
		return self::result( 'rest_api', __( 'REST API', 'bridgistic' ), 'pass',
			__( 'The WordPress REST API responds.', 'bridgistic' ), '' );
	}

	/** @param array<string,mixed> $probe */
	private static function check_namespace( array $probe ): array {
		$registered = in_array( BRIDGISTIC_REST_NAMESPACE, rest_get_server()->get_namespaces(), true );
		if ( ! $registered ) {
			return self::result( 'namespace', __( 'Bridgistic namespace', 'bridgistic' ), 'fail',
				sprintf( __( 'The %s REST namespace is not registered.', 'bridgistic' ), BRIDGISTIC_REST_NAMESPACE ),
				__( 'Deactivate and reactivate the Bridgistic plugin. If it persists, another plugin may be interfering with rest_api_init.', 'bridgistic' )
			);
		}
		// The unsigned probe should get OUR 401, proving routing reaches the plugin.
		$code = is_array( $probe['json'] ) ? (string) ( $probe['json']['code'] ?? '' ) : '';
		if ( 0 === strpos( $code, 'bridgistic_' ) || 200 === $probe['code'] ) {
			return self::result( 'namespace', __( 'Bridgistic namespace', 'bridgistic' ), 'pass',
				__( 'Bridgistic routes are registered and reachable.', 'bridgistic' ), '' );
		}
		return self::result( 'namespace', __( 'Bridgistic namespace', 'bridgistic' ), 'warn',
			__( 'Routes are registered, but the loopback probe did not reach the Bridgistic handler.', 'bridgistic' ),
			__( 'Usually harmless (loopback quirk). If Claude cannot connect, check the WAF result below.', 'bridgistic' )
		);
	}

	/** @param array<string,mixed> $probe */
	private static function check_waf( array $probe ): array {
		$code = is_array( $probe['json'] ) ? (string) ( $probe['json']['code'] ?? '' ) : '';
		if ( 0 === strpos( $code, 'bridgistic_' ) ) {
			return self::result( 'waf', __( 'Security plugin / WAF', 'bridgistic' ), 'pass',
				__( 'Requests reach Bridgistic unmodified — no firewall interference detected.', 'bridgistic' ), '' );
		}
		if ( in_array( $probe['code'], array( 403, 406, 503 ), true ) || ( $probe['code'] >= 400 && null === $probe['json'] && '' !== $probe['body'] ) ) {
			return self::result( 'waf', __( 'Security plugin / WAF', 'bridgistic' ), 'warn',
				sprintf( __( 'A security layer may be intercepting REST requests (HTTP %d, non-Bridgistic response).', 'bridgistic' ), $probe['code'] ),
				__( 'Allowlist the /wp-json/bridgistic/v1/ namespace in your security plugin or CDN firewall, and make sure X-Bridgistic-* headers are not stripped.', 'bridgistic' )
			);
		}
		return self::result( 'waf', __( 'Security plugin / WAF', 'bridgistic' ), 'pass',
			__( 'No firewall interference detected.', 'bridgistic' ), '' );
	}

	/**
	 * Full-pipeline HMAC self-test: mint an ephemeral read-only key, sign a
	 * loopback request exactly like the MCP server does, then delete the key.
	 */
	private static function check_hmac(): array {
		$created = KeyStore::create( 'Health self-test (auto-removed)', array( Scopes::SITE_READ ), array(), 30 );

		try {
			$path      = '/' . BRIDGISTIC_REST_NAMESPACE . '/site-info';
			$timestamp = (string) time();
			$nonce     = bin2hex( random_bytes( 8 ) );
			$canonical = implode( "\n", array( 'GET', $path, $timestamp, $nonce, hash( 'sha256', '' ) ) );
			$signature = hash_hmac( 'sha256', $canonical, $created['secret'] );

			$res = wp_remote_get(
				rest_url( BRIDGISTIC_REST_NAMESPACE . '/site-info' ),
				array(
					'timeout'   => 10,
					'sslverify' => false,
					'headers'   => array(
						'X-Bridgistic-Key'       => $created['key_id'],
						'X-Bridgistic-Timestamp' => $timestamp,
						'X-Bridgistic-Nonce'     => $nonce,
						'X-Bridgistic-Signature' => $signature,
					),
				)
			);
		} finally {
			KeyStore::revoke( $created['key_id'] );
		}

		if ( is_wp_error( $res ) ) {
			return self::result( 'hmac', __( 'HMAC authentication', 'bridgistic' ), 'warn',
				sprintf( __( 'Could not run the loopback self-test: %s', 'bridgistic' ), $res->get_error_message() ),
				__( 'Loopback requests may be blocked on this host. Test from Claude directly — authentication can still work from outside.', 'bridgistic' )
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( 200 === $code ) {
			return self::result( 'hmac', __( 'HMAC authentication', 'bridgistic' ), 'pass',
				__( 'A signed test request authenticated end-to-end (signature, timestamp, nonce, scopes).', 'bridgistic' ), '' );
		}

		$json = json_decode( (string) wp_remote_retrieve_body( $res ), true );
		$why  = is_array( $json ) ? (string) ( $json['code'] ?? "HTTP {$code}" ) : "HTTP {$code}";
		return self::result( 'hmac', __( 'HMAC authentication', 'bridgistic' ), 'fail',
			sprintf( __( 'The signed self-test was rejected (%s).', 'bridgistic' ), $why ),
			__( 'If the code is bridgistic_auth_stale, fix server time (see Server time below). Otherwise a proxy may be altering request bodies or stripping X-Bridgistic-* headers.', 'bridgistic' )
		);
	}

	private static function check_site_url(): array {
		$home = home_url();
		if ( ! wp_http_validate_url( $home ) ) {
			return self::result( 'site_url', __( 'Site URL', 'bridgistic' ), 'fail',
				sprintf( __( 'The configured site URL (%s) is not a valid URL.', 'bridgistic' ), $home ),
				__( 'Fix it in Settings → General. Claude configs embed this value.', 'bridgistic' )
			);
		}
		if ( get_option( 'siteurl' ) !== get_option( 'home' ) ) {
			return self::result( 'site_url', __( 'Site URL', 'bridgistic' ), 'warn',
				__( 'WordPress Address and Site Address differ. That is fine, but always use the Site Address in Claude configs.', 'bridgistic' ),
				sprintf( __( 'Use %s in your Claude config.', 'bridgistic' ), $home )
			);
		}
		return self::result( 'site_url', __( 'Site URL', 'bridgistic' ), 'pass',
			sprintf( __( '%s is valid.', 'bridgistic' ), $home ), '' );
	}

	private static function check_ssl(): array {
		if ( 0 === strpos( home_url(), 'https://' ) ) {
			return self::result( 'ssl', __( 'SSL / HTTPS', 'bridgistic' ), 'pass',
				__( 'The site uses HTTPS. Signed requests travel encrypted.', 'bridgistic' ), '' );
		}
		$host     = (string) wp_parse_url( home_url(), PHP_URL_HOST );
		$is_local = (bool) preg_match( '/^(localhost|127\.0\.0\.1|.*\.(local|test))$/', $host );
		return self::result( 'ssl', __( 'SSL / HTTPS', 'bridgistic' ), $is_local ? 'warn' : 'fail',
			$is_local
				? __( 'Running on plain HTTP — acceptable for a local development site only.', 'bridgistic' )
				: __( 'The site is served over plain HTTP. Do not connect AI tooling to a production site without HTTPS.', 'bridgistic' ),
			__( 'Install an SSL certificate (most hosts offer free Let\'s Encrypt) and update the site URL to https://.', 'bridgistic' )
		);
	}

	private static function check_permalinks(): array {
		if ( get_option( 'permalink_structure' ) ) {
			return self::result( 'permalinks', __( 'Permalinks', 'bridgistic' ), 'pass',
				__( 'Pretty permalinks are enabled — /wp-json/ routing works.', 'bridgistic' ), '' );
		}
		return self::result( 'permalinks', __( 'Permalinks', 'bridgistic' ), 'warn',
			__( 'Permalinks are set to "Plain". The REST API falls back to ?rest_route=, which some clients and firewalls mishandle.', 'bridgistic' ),
			__( 'Choose any pretty structure under Settings → Permalinks and save.', 'bridgistic' )
		);
	}

	private static function check_php_version(): array {
		$ok = version_compare( PHP_VERSION, self::MIN_PHP, '>=' );
		return self::result( 'php', __( 'PHP version', 'bridgistic' ), $ok ? 'pass' : 'fail',
			sprintf( __( 'Running PHP %1$s (minimum %2$s).', 'bridgistic' ), PHP_VERSION, self::MIN_PHP ),
			$ok ? '' : __( 'Ask your host to switch this site to PHP 8.0 or newer.', 'bridgistic' )
		);
	}

	private static function check_wp_version(): array {
		global $wp_version;
		$ok = version_compare( $wp_version, self::MIN_WP, '>=' );
		return self::result( 'wp', __( 'WordPress version', 'bridgistic' ), $ok ? 'pass' : 'fail',
			sprintf( __( 'Running WordPress %1$s (minimum %2$s).', 'bridgistic' ), $wp_version, self::MIN_WP ),
			$ok ? '' : __( 'Update WordPress from Dashboard → Updates.', 'bridgistic' )
		);
	}

	private static function check_uploads_writable(): array {
		$uploads = wp_upload_dir();
		if ( ! empty( $uploads['error'] ) || ! wp_is_writable( $uploads['basedir'] ) ) {
			return self::result( 'uploads', __( 'Uploads directory', 'bridgistic' ), 'fail',
				__( 'The uploads directory is not writable — media tools and the sandbox cannot work.', 'bridgistic' ),
				sprintf( __( 'Fix permissions on %s (your host can do this).', 'bridgistic' ), esc_html( (string) $uploads['basedir'] ) )
			);
		}
		return self::result( 'uploads', __( 'Uploads directory', 'bridgistic' ), 'pass',
			__( 'The uploads directory is writable.', 'bridgistic' ), '' );
	}

	private static function check_sandbox_protected(): array {
		$uploads = wp_upload_dir();
		$dir     = trailingslashit( $uploads['basedir'] ) . BRIDGISTIC_SANDBOX;
		if ( ! is_dir( $dir ) ) {
			return self::result( 'sandbox', __( 'Sandbox directory', 'bridgistic' ), 'warn',
				__( 'The PHP sandbox directory does not exist yet.', 'bridgistic' ),
				__( 'Deactivate and reactivate the plugin to recreate it, or ignore this if you never grant fs:write.', 'bridgistic' )
			);
		}
		if ( ! file_exists( $dir . '/.htaccess' ) || ! file_exists( $dir . '/index.php' ) ) {
			return self::result( 'sandbox', __( 'Sandbox directory', 'bridgistic' ), 'fail',
				__( 'The sandbox exists but its protection files (.htaccess / index.php) are missing.', 'bridgistic' ),
				__( 'Deactivate and reactivate the plugin to restore them. On nginx, also deny direct access to the bridgistic-sandbox folder in your server config.', 'bridgistic' )
			);
		}
		return self::result( 'sandbox', __( 'Sandbox directory', 'bridgistic' ), 'pass',
			__( 'The sandbox directory exists and direct web execution is blocked.', 'bridgistic' ), '' );
	}

	private static function check_table( string $suffix, string $label ): array {
		global $wpdb;
		$table  = $wpdb->prefix . $suffix;
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table; // phpcs:ignore WordPress.DB
		return self::result( $suffix, $label, $exists ? 'pass' : 'fail',
			$exists
				? sprintf( __( 'Table %s exists.', 'bridgistic' ), $table )
				: sprintf( __( 'Table %s is missing.', 'bridgistic' ), $table ),
			$exists ? '' : __( 'Deactivate and reactivate the Bridgistic plugin to recreate its tables.', 'bridgistic' )
		);
	}

	private static function check_key_scopes(): array {
		$keys = KeyStore::list_all();
		if ( ! $keys ) {
			return self::result( 'scopes', __( 'Key scopes', 'bridgistic' ), 'info',
				__( 'No keys yet — create one in Claude Setup.', 'bridgistic' ),
				''
			);
		}
		$valid   = array_keys( Scopes::all() );
		$broken  = array();
		$enabled = 0;
		foreach ( $keys as $k ) {
			$scopes = (array) json_decode( (string) $k['scopes'], true );
			if ( array_diff( $scopes, $valid ) ) {
				$broken[] = (string) $k['key_id'];
			}
			if ( (int) $k['enabled'] === 1 ) {
				++$enabled;
			}
		}
		if ( $broken ) {
			return self::result( 'scopes', __( 'Key scopes', 'bridgistic' ), 'warn',
				sprintf( __( '%d key(s) carry unknown scopes (created by a different version?).', 'bridgistic' ), count( $broken ) ),
				__( 'Rotate or recreate the affected keys from Keys & Scopes.', 'bridgistic' )
			);
		}
		return self::result( 'scopes', __( 'Key scopes', 'bridgistic' ), 'pass',
			sprintf( __( '%1$d key(s), %2$d enabled — all scopes valid.', 'bridgistic' ), count( $keys ), $enabled ), '' );
	}

	private static function check_config_generated(): array {
		$when = (int) get_option( ConfigGenerator::GENERATED_FLAG, 0 );
		if ( $when ) {
			return self::result( 'config', __( 'MCP config generated', 'bridgistic' ), 'pass',
				sprintf( __( 'A Claude config was generated %s ago.', 'bridgistic' ), human_time_diff( $when ) ), '' );
		}
		return self::result( 'config', __( 'MCP config generated', 'bridgistic' ), 'info',
			__( 'No Claude config generated yet.', 'bridgistic' ),
			__( 'Use the Claude Setup page to create a key and generate your config.', 'bridgistic' )
		);
	}

	private static function check_time_drift(): array {
		global $wpdb;
		$db_time  = (int) $wpdb->get_var( 'SELECT UNIX_TIMESTAMP()' ); // phpcs:ignore WordPress.DB
		$php_time = time();
		$drift    = abs( $db_time - $php_time );

		if ( $drift > 30 ) {
			return self::result( 'time', __( 'Server time', 'bridgistic' ), 'warn',
				sprintf( __( 'PHP and database clocks differ by %d seconds — server time may be unreliable.', 'bridgistic' ), $drift ),
				__( 'Signed requests allow ±300s of drift between Claude\'s machine and this server. Ask your host to enable NTP.', 'bridgistic' )
			);
		}
		return self::result( 'time', __( 'Server time', 'bridgistic' ), 'pass',
			__( 'Server clocks agree. Remember the ±300s window also depends on the clock of the computer running Claude.', 'bridgistic' ), '' );
	}

	/**
	 * @return array{id:string,label:string,status:string,message:string,fix:string}
	 */
	private static function result( string $id, string $label, string $status, string $message, string $fix ): array {
		return compact( 'id', 'label', 'status', 'message', 'fix' );
	}
}
