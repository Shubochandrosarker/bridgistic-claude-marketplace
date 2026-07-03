<?php
/**
 * Claude Setup: five-step guided connection wizard.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic\Admin;

use Bridgistic\Security\KeyStore;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class ClaudeSetupPage extends Page {

	protected function view(): string {
		return 'claude-setup';
	}

	protected function data(): array {
		return array(
			'presets'    => Presets::all(),
			'site_url'   => home_url(),
			'keys_count' => count( KeyStore::list_all() ),
			'export_url' => admin_url( 'admin.php?page=bridgistic-export' ),
			'marketplace_cmds' => "/plugin marketplace add Shubochandrosarker/bridgistic-claude-marketplace\n/plugin install bridgistic@bridgistic-marketplace",
		);
	}
}
