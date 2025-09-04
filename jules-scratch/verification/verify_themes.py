import pytest
from playwright.sync_api import Page, expect

def test_theme_switcher(page: Page):
    """
    This test verifies that the theme switcher functionality is working.
    It loads the page, takes a screenshot of the default (dark) theme,
    switches to the light theme, and takes another screenshot to
    confirm the change.
    """

    # 1. Arrange: Go to the application URL.
    page.goto("https://script.google.com/macros/s/AKfycbzRzts0VCkAMdjmBYVdWXsAU6QzfThIgoy4Uu4vzb218sFriBlbEHdnGDAfIn7vYI-N/exec")

    # Wait for the main calendar grid to be visible, indicating the app has loaded.
    expect(page.locator("#grille-calendrier")).to_be_visible(timeout=20000)

    # Give it an extra moment for any animations or late-loading elements.
    page.wait_for_timeout(1000)

    # 2. Act & Screenshot 1: Capture the default (dark) theme.
    page.screenshot(path="jules-scratch/verification/dark_theme.png")

    # 3. Act: Switch to the light theme.
    theme_button = page.locator("#btn-theme")
    # The button might be hidden if the feature flag isn't working, so we assert its visibility.
    expect(theme_button).to_be_visible()
    theme_button.click()

    # Find and click the "Clarté" (light theme) button in the menu.
    light_theme_option = page.get_by_role("button", name="Clarté")
    expect(light_theme_option).to_be_visible()
    light_theme_option.click()

    # Wait for the theme change to apply.
    page.wait_for_timeout(1000)

    # 4. Screenshot 2 & Assert: Capture the light theme.
    # We will use this screenshot as the final verification artifact.
    page.screenshot(path="jules-scratch/verification/light_theme.png")

    # As a final check, we can assert something simple, like the background color.
    # Note: This is a bit brittle, but good for a verification script.
    body = page.locator("body")
    expect(body).to_have_css("background-color", "rgb(248, 249, 250)") # --bg: #f8f9fa
