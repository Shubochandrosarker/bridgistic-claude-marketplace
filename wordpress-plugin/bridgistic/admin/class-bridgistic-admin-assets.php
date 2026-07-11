<?php
/**
 * Admin asset loading — Bridgistic screens only, never globally.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Assets {

	public function hooks(): void {
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * True only on Bridgistic admin screens (hook suffix carries the page slug).
	 */
	private function is_bridgistic_screen( string $hook_suffix ): bool {
		if ( false !== strpos( $hook_suffix, 'page_bridgistic' ) ) {
			return true;
		}
		return 'toplevel_page_bridgistic' === $hook_suffix;
	}

	public function enqueue( string $hook_suffix ): void {
		if ( ! $this->is_bridgistic_screen( $hook_suffix ) ) {
			return;
		}

		wp_enqueue_style(
			'bridgistic-admin',
			BRIDGISTIC_URL . 'assets/admin/css/bridgistic-admin.css',
			array(),
			BRIDGISTIC_VERSION
		);

		wp_enqueue_script(
			'bridgistic-admin',
			BRIDGISTIC_URL . 'assets/admin/js/bridgistic-admin.js',
			array(),
			BRIDGISTIC_VERSION,
			true
		);

		$slug = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : 'bridgistic'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only routing.

		wp_localize_script(
			'bridgistic-admin',
			'bridgisticAdmin',
			array(
				'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
				'adminPost' => admin_url( 'admin-post.php' ),
				'nonce'     => wp_create_nonce( 'bridgistic_admin' ),
				'page'      => $slug,
				'siteUrl'   => home_url(),
				'restNs'    => BRIDGISTIC_REST_NAMESPACE,
				'i18n'      => array(
					'copied'             => __( 'Copied to clipboard', 'bridgistic' ),
					'copyFailed'         => __( 'Copy failed — select and copy manually', 'bridgistic' ),
					'working'            => __( 'Working…', 'bridgistic' ),
					'error'              => __( 'Something went wrong. Check the Health page.', 'bridgistic' ),
					'confirmRevoke'      => __( 'Revoke this key? Claude will immediately lose access.', 'bridgistic' ),
					'confirmDelete'      => __( 'Permanently delete? This cannot be undone.', 'bridgistic' ),
					'confirmRestore'     => __( 'Restoring a snapshot may overwrite current changes. Create a backup first. Continue?', 'bridgistic' ),
					'confirmRotate'      => __( 'Rotate the secret? Existing Claude configs stop working until you paste the new secret.', 'bridgistic' ),
					'confirmDevMode'     => __( 'Developer Mode can access sensitive tools such as database, filesystem, and PHP execution. Use only on sites you control. Continue?', 'bridgistic' ),
					'secretOnce'         => __( 'Shown once — copy it now. It is stored encrypted and cannot be displayed again.', 'bridgistic' ),
					'testRunning'        => __( 'Testing connection…', 'bridgistic' ),
					'healthRunning'      => __( 'Running checks…', 'bridgistic' ),
					'done'               => __( 'Done', 'bridgistic' ),
					'clientWaiting'      => __( "Waiting for your AI client's first request…", 'bridgistic' ),
					'clientConnected'    => __( 'Connected — a real request just came in from your AI client.', 'bridgistic' ),
					'clientStillWaiting' => __( "Still waiting. That's normal if you haven't asked your AI assistant to do anything yet.", 'bridgistic' ),
					'checkNow'           => __( 'Check now', 'bridgistic' ),
				),
			)
		);

		// Apply the saved theme before first paint to avoid a flash.
		wp_add_inline_script(
			'bridgistic-admin',
			'try{var t=localStorage.getItem("bridgistic-theme");if(t){document.documentElement.setAttribute("data-bridgistic-theme",t);}}catch(e){}',
			'before'
		);
	}
}
