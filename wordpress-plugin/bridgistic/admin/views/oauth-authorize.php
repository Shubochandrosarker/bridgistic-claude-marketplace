<?php
/**
 * OAuth consent screen. Standalone page (no wp-admin chrome) - see
 * OAuthAuthorizePage::render().
 *
 * @package Bridgistic
 * @var array<string,mixed> $data
 */

declare( strict_types=1 );

namespace Bridgistic\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title><?php esc_html_e( 'Connect Bridgistic Cloud', 'bridgistic' ); ?></title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f3f4f6; color: #1f2430; margin: 0; padding: 48px 20px; }
		.bridgistic-consent-card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e2e4e9; border-radius: 14px; padding: 32px; box-shadow: 0 8px 30px rgba(20,20,40,.08); }
		.bridgistic-consent-card h1 { font-size: 1.3rem; margin: 0 0 6px; }
		.bridgistic-consent-card p.lead { color: #565d6d; margin: 0 0 24px; }
		.bridgistic-consent-site { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #f6f7fb; border-radius: 10px; margin-bottom: 22px; font-size: .92rem; }
		.bridgistic-consent-presets { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
		.bridgistic-consent-presets label { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid #e2e4e9; border-radius: 10px; cursor: pointer; }
		.bridgistic-consent-presets label:has(input:checked) { border-color: #2f6690; background: #eef4f8; }
		.bridgistic-consent-presets input { margin-top: 3px; }
		.bridgistic-consent-presets strong { display: block; font-size: .92rem; }
		.bridgistic-consent-presets span.desc { display: block; font-size: .82rem; color: #6b7280; }
		.bridgistic-consent-actions { display: flex; gap: 10px; }
		.bridgistic-consent-actions button { flex: 1; padding: 11px 16px; border-radius: 9px; font-size: .92rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
		.bridgistic-consent-actions .allow { background: #2f6690; color: #fff; }
		.bridgistic-consent-actions .deny { background: #fff; color: #40465a; border-color: #d7dae0; }
		.bridgistic-consent-error { color: #9a2f24; background: #fbeae8; border: 1px solid #f0c9c4; border-radius: 10px; padding: 14px; }
	</style>
</head>
<body>
	<div class="bridgistic-consent-card">
		<h1><?php esc_html_e( 'Connect this site to Bridgistic Cloud', 'bridgistic' ); ?></h1>

		<?php if ( $data['error'] ) : ?>
			<p class="bridgistic-consent-error"><?php echo esc_html( (string) $data['error'] ); ?></p>
		<?php else : ?>
			<p class="lead"><?php esc_html_e( 'The Bridgistic cloud connector (mcp.wpistic.cloud) is asking to control this site through your AI assistant. Choose what it can do, then allow or deny.', 'bridgistic' ); ?></p>

			<div class="bridgistic-consent-site">
				<?php echo Page::icon( 'globe', 18 ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				<span><?php echo esc_html( home_url() ); ?></span>
			</div>

			<form method="post" action="<?php echo esc_url( (string) $data['action_url'] ); ?>">
				<input type="hidden" name="action" value="bridgistic_oauth_consent" />
				<input type="hidden" name="client_id" value="<?php echo esc_attr( (string) $data['client_id'] ); ?>" />
				<input type="hidden" name="redirect_uri" value="<?php echo esc_attr( (string) $data['redirect_uri'] ); ?>" />
				<input type="hidden" name="code_challenge" value="<?php echo esc_attr( (string) $data['code_challenge'] ); ?>" />
				<input type="hidden" name="state" value="<?php echo esc_attr( (string) $data['state'] ); ?>" />
				<?php wp_nonce_field( 'bridgistic_oauth_consent' ); ?>

				<div class="bridgistic-consent-presets">
					<?php foreach ( $data['presets'] as $preset_id => $preset ) : ?>
						<label>
							<input type="radio" name="preset" value="<?php echo esc_attr( $preset_id ); ?>" <?php checked( 'read_only', $preset_id ); ?> />
							<span>
								<strong><?php echo esc_html( (string) $preset['label'] ); ?></strong>
								<span class="desc"><?php echo esc_html( (string) $preset['description'] ); ?></span>
							</span>
						</label>
					<?php endforeach; ?>
				</div>

				<div class="bridgistic-consent-actions">
					<button type="submit" name="decision" value="deny" class="deny"><?php esc_html_e( 'Deny', 'bridgistic' ); ?></button>
					<button type="submit" name="decision" value="allow" class="allow"><?php esc_html_e( 'Allow', 'bridgistic' ); ?></button>
				</div>
			</form>
		<?php endif; ?>
	</div>
</body>
</html>
