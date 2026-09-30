package app.routinetracker;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Registra as geofences no Play Services. Quem monitora é o sistema — o app não fica rodando. */
final class GeofenceHelper {
    /** Limite do Android: 100 geofences por app. */
    private static final int MAX_FENCES = 100;

    interface Done {
        void onDone(int count, String message);
    }

    private GeofenceHelper() {}

    static PendingIntent pendingIntent(Context c) {
        Intent i = new Intent(c, GeofenceReceiver.class);
        // O sistema preenche extras no intent (evento da geofence): precisa ser MUTABLE no Android 12+.
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, 0, i, flags);
    }

    private static void finish(Context c, int count, String msg, Done done) {
        NativeStore.setLastSync(c, msg, count);
        if (done != null) done.onDone(count, msg);
    }

    /** Remove todas as geofences do app. */
    static void clear(Context ctx, final Done done) {
        final Context c = ctx.getApplicationContext();
        LocationServices.getGeofencingClient(c)
                .removeGeofences(pendingIntent(c))
                .addOnCompleteListener(task -> finish(c, 0, "Rastreamento pausado", done));
    }

    /** Recadastra TODAS as geofences a partir dos lugares guardados (idempotente). */
    @SuppressLint("MissingPermission")
    static void sync(Context ctx, final Done done) {
        final Context c = ctx.getApplicationContext();
        if (NativeStore.paused(c)) {
            finish(c, 0, "Rastreamento pausado", done);
            return;
        }
        if (!Perm.hasFine(c)) {
            finish(c, 0, "Sem permiss\u00E3o de localiza\u00E7\u00E3o", done);
            return;
        }

        final List<Geofence> fences = new ArrayList<>();
        JSONArray places = NativeStore.places(c);
        for (int i = 0; i < places.length() && fences.size() < MAX_FENCES; i++) {
            JSONObject p = places.optJSONObject(i);
            if (p == null) continue;
            String id = p.optString("id", "");
            if (id.isEmpty()) continue;
            float radius = (float) Math.max(100.0, p.optDouble("r", 150.0));
            fences.add(new Geofence.Builder()
                    .setRequestId(id)
                    .setCircularRegion(p.optDouble("lat"), p.optDouble("lng"), radius)
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                    .build());
        }

        final GeofencingClient client = LocationServices.getGeofencingClient(c);
        final PendingIntent pi = pendingIntent(c);
        client.removeGeofences(pi).addOnCompleteListener(removed -> {
            if (fences.isEmpty()) {
                finish(c, 0, "Nenhum lugar ativo", done);
                return;
            }
            // Se a pessoa já estiver dentro de uma cerca, o sistema dispara ENTER na hora.
            GeofencingRequest request = new GeofencingRequest.Builder()
                    .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                    .addGeofences(fences)
                    .build();
            client.addGeofences(request, pi)
                    .addOnSuccessListener(v -> finish(c, fences.size(), fences.size() + " geofence(s) ativa(s)", done))
                    .addOnFailureListener(e -> {
                        String why = e instanceof ApiException
                                ? GeofenceStatusCodes.getStatusCodeString(((ApiException) e).getStatusCode())
                                : String.valueOf(e.getMessage());
                        NativeStore.setLastError(c, "addGeofences: " + why);
                        finish(c, 0, "Falha ao registrar: " + why, done);
                    });
        });
    }
}
