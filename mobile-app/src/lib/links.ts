import { Alert, Linking, Platform } from "react-native";

/**
 * Open the device's native maps app (Apple Maps on iOS, Google Maps on
 * Android) for navigation to the given destination. Falls back to the
 * Google Maps web URL if neither app can handle the scheme.
 */
export async function openMaps(destination: string): Promise<void> {
  const q = encodeURIComponent(destination);
  const candidates =
    Platform.OS === "ios"
      ? [
          `comgooglemaps://?daddr=${q}&directionsmode=driving`,
          `http://maps.apple.com/?daddr=${q}`,
          `https://www.google.com/maps/dir/?api=1&destination=${q}`,
        ]
      : [
          `google.navigation:q=${q}`,
          `geo:0,0?q=${q}`,
          `https://www.google.com/maps/dir/?api=1&destination=${q}`,
        ];

  for (const url of candidates) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* try next */
    }
  }
  Alert.alert("Maps unavailable", "Could not open a maps app on this device.");
}

/**
 * Open WhatsApp with a pre-filled message. If `phone` is provided, the chat
 * opens directly with that number; otherwise the user can pick a contact.
 */
export async function openWhatsApp(opts: {
  phone?: string;
  message: string;
}): Promise<void> {
  const text = encodeURIComponent(opts.message);
  // Normalize phone: strip everything except digits.
  const phone = (opts.phone ?? "").replace(/\D/g, "");

  const appUrl = phone
    ? `whatsapp://send?phone=${phone}&text=${text}`
    : `whatsapp://send?text=${text}`;
  const webUrl = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  try {
    const ok = await Linking.canOpenURL(appUrl);
    await Linking.openURL(ok ? appUrl : webUrl);
  } catch {
    Alert.alert(
      "WhatsApp unavailable",
      "WhatsApp does not appear to be installed."
    );
  }
}

/** Open a `tel:` URL — the dialer opens with the number pre-filled. */
export async function openDialer(phone: string): Promise<void> {
  const cleaned = phone.replace(/[^\d+]/g, "");
  try {
    await Linking.openURL(`tel:${cleaned}`);
  } catch {
    Alert.alert("Could not open dialer");
  }
}
