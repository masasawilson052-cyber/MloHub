import { Alert, Platform } from 'react-native';

/**
 * Universal Web Alert & Confirmation Polyfill
 *
 * In react-native-web, Alert.alert is an empty stub: `static alert() {}`.
 * On web/desktop platforms, this polyfill redirects:
 * - Simple informational alerts to `window.alert(...)`
 * - Action/confirmation dialogs (2+ buttons or destructive style) to `window.confirm(...)`
 *
 * This ensures that on desktop browsers (Chrome, Edge, Safari, Firefox), clicking
 * "Sign Out", "Cancel Order", "Delete Address", etc. properly triggers the browser
 * confirmation prompt and executes the corresponding `onPress` callback.
 */
export function initAlertPolyfill() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  Alert.alert = (
    title?: string,
    message?: string,
    buttons?: Array<{
      text?: string;
      onPress?: () => void | Promise<void>;
      style?: 'default' | 'cancel' | 'destructive';
    }>
  ) => {
    const promptText = [title, message].filter(Boolean).join('\n\n');

    // Case 1: Informational alert (0 buttons or 1 non-cancel button)
    if (!buttons || buttons.length === 0) {
      if (promptText) {
        window.alert(promptText);
      }
      return;
    }

    if (buttons.length === 1 && buttons[0].style !== 'cancel') {
      if (promptText) {
        window.alert(promptText);
      }
      buttons[0].onPress?.();
      return;
    }

    // Case 2: Confirmation / Action Dialog (Cancel + Action buttons)
    const confirmed = window.confirm(promptText);
    if (confirmed) {
      const actionButton =
        buttons.find((btn) => btn.style === 'destructive' || btn.style !== 'cancel') ||
        buttons[buttons.length - 1];
      actionButton?.onPress?.();
    } else {
      const cancelButton = buttons.find((btn) => btn.style === 'cancel');
      cancelButton?.onPress?.();
    }
  };
}

initAlertPolyfill();
