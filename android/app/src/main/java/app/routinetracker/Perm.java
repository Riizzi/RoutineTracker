package app.routinetracker;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

final class Perm {
    private Perm() {}

    private static boolean has(Context c, String p) {
        return ContextCompat.checkSelfPermission(c, p) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean hasFine(Context c) {
        return has(c, Manifest.permission.ACCESS_FINE_LOCATION);
    }

    static boolean hasCoarse(Context c) {
        return has(c, Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    /** Antes do Android 10 a permissão de "o tempo todo" não existe: vale a de localização normal. */
    static boolean hasBackground(Context c) {
        if (Build.VERSION.SDK_INT < 29) return hasFine(c);
        return has(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION);
    }

    static boolean hasNotificationPermission(Context c) {
        if (Build.VERSION.SDK_INT < 33) return true;
        return has(c, "android.permission.POST_NOTIFICATIONS");
    }
}
