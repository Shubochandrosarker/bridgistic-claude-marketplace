<?php
/**
 * Admin controller: loads the modular admin layer, registers the menu,
 * and routes each screen to its page class.
 *
 * Design contract: this layer is presentation + admin actions only. It calls
 * into the existing KeyStore / Scopes / AuditLog / Snapshot / Playbooks /
 * Approvals / Scheduler APIs and never modifies the auth or REST pipeline.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-bridgistic-admin-assets.php';
require_once __DIR__ . '/class-bridgistic-admin-actions.php';
require_once __DIR__ . '/class-bridgistic-presets.php';
require_once __DIR__ . '/class-bridgistic-config-generator.php';
require_once __DIR__ . '/class-bridgistic-health-check.php';
require_once __DIR__ . '/class-bridgistic-page.php';
require_once __DIR__ . '/class-bridgistic-dashboard-page.php';
require_once __DIR__ . '/class-bridgistic-claude-setup-page.php';
require_once __DIR__ . '/class-bridgistic-keys-page.php';
require_once __DIR__ . '/class-bridgistic-approvals-page.php';
require_once __DIR__ . '/class-bridgistic-health-page.php';
require_once __DIR__ . '/class-bridgistic-logs-page.php';
require_once __DIR__ . '/class-bridgistic-snapshots-page.php';
require_once __DIR__ . '/class-bridgistic-playbooks-page.php';
require_once __DIR__ . '/class-bridgistic-export-page.php';
require_once __DIR__ . '/class-bridgistic-premium-page.php';
require_once __DIR__ . '/class-bridgistic-settings-page.php';
require_once __DIR__ . '/class-bridgistic-oauth-page.php';

final class Controller {

	/** Capability required for every Bridgistic screen and action. */
	public const CAP = 'manage_options';

	/**
	 * Screen registry: slug => [ menu label, page class ].
	 *
	 * @return array<string,array{0:string,1:class-string<Page>}>
	 */
	public static function pages(): array {
		return array(
			'bridgistic'           => array( __( 'Dashboard', 'bridgistic' ), DashboardPage::class ),
			'bridgistic-setup'     => array( __( 'Claude Setup', 'bridgistic' ), ClaudeSetupPage::class ),
			'bridgistic-keys'      => array( __( 'Keys & Scopes', 'bridgistic' ), KeysPage::class ),
			'bridgistic-approvals' => array( __( 'Approvals', 'bridgistic' ), ApprovalsPage::class ),
			'bridgistic-health'    => array( __( 'Health Check', 'bridgistic' ), HealthPage::class ),
			'bridgistic-logs'      => array( __( 'Logs', 'bridgistic' ), LogsPage::class ),
			'bridgistic-snapshots' => array( __( 'Snapshots', 'bridgistic' ), SnapshotsPage::class ),
			'bridgistic-playbooks' => array( __( 'Playbooks', 'bridgistic' ), PlaybooksPage::class ),
			'bridgistic-export'    => array( __( 'Export Package', 'bridgistic' ), ExportPage::class ),
			'bridgistic-premium'   => array( __( 'Premium Features', 'bridgistic' ), PremiumPage::class ),
			'bridgistic-settings'  => array( __( 'Settings', 'bridgistic' ), SettingsPage::class ),
		);
	}

	public function hooks(): void {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		( new Assets() )->hooks();
		( new Actions() )->hooks();
	}

	public function menu(): void {
		add_menu_page(
			'Bridgistic',
			'Bridgistic',
			self::CAP,
			'bridgistic',
			array( $this, 'render' ),
			'dashicons-rest-api',
			81
		);

		foreach ( self::pages() as $slug => $page ) {
			add_submenu_page( 'bridgistic', 'Bridgistic — ' . $page[0], $page[0], self::CAP, $slug, array( $this, 'render' ) );
		}

		// Hidden: reached only via a deep link from the cloud connector's OAuth
		// redirect, never shown in the sidebar (null parent slug).
		add_submenu_page( null, 'Connect Bridgistic Cloud', '', self::CAP, 'bridgistic-oauth-authorize', array( $this, 'render_oauth_authorize' ) );
	}

	/**
	 * Route the current screen to its page class inside the shared layout.
	 */
	public function render(): void {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'Not allowed.', 'bridgistic' ) );
		}

		$slug  = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : 'bridgistic'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only routing.
		$pages = self::pages();
		if ( ! isset( $pages[ $slug ] ) ) {
			$slug = 'bridgistic';
		}

		$class = $pages[ $slug ][1];
		$page  = new $class( $slug, $pages[ $slug ][0] );
		$page->render();
	}

	/**
	 * The OAuth consent screen isn't in pages() (it's hidden from the nav
	 * and renders its own standalone HTML, not the shared dashboard shell),
	 * so it gets its own capability-gated entry point.
	 */
	public function render_oauth_authorize(): void {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'Not allowed.', 'bridgistic' ) );
		}
		( new OAuthAuthorizePage( 'bridgistic-oauth-authorize', 'Connect Bridgistic Cloud' ) )->render();
	}
}
