package app.routinetracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingEvent;
import java.util.List;

/** Acordado pelo sistema quando a pessoa entra/sai de uma geofence — mesmo com o app fechado. */
public class GeofenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null) return;
        if (event.hasError()) {
            NativeStore.setLastError(context, "geofence: " + GeofenceStatusCodes.getStatusCodeString(event.getErrorCode()));
            return;
        }
        int transition = event.getGeofenceTransition();
        String type;
        if (transition == Geofence.GEOFENCE_TRANSITION_ENTER) type = "ENTER";
        else if (transition == Geofence.GEOFENCE_TRANSITION_EXIT) type = "EXIT";
        else return;

        List<Geofence> fences = event.getTriggeringGeofences();
        if (fences == null || fences.isEmpty()) return;

        long now = System.currentTimeMillis();
        long ts = now;
        double lat = Double.NaN;
        double lng = Double.NaN;
        Location loc = event.getTriggeringLocation();
        if (loc != null) {
            lat = loc.getLatitude();
            lng = loc.getLongitude();
            long t = loc.getTime();
            // O aviso pode chegar atrasado; usa a hora do fix se for recente e plausível.
            if (t > 0 && t <= now && now - t < 30L * 60 * 1000) ts = t;
        }
        for (Geofence g : fences) {
            NativeStore.recordTransition(context, type, g.getRequestId(), ts, lat, lng);
        }
        Notifier.refreshStatus(context);
    }
}
