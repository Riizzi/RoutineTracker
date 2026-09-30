package app.routinetracker;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Ponte JS ⇄ Android. A localização "normal" (permissão em primeiro plano, posição atual) fica
 * com @capacitor/geolocation; aqui ficam: permissão de segundo plano, notificações, geofences,
 * configuração e o "pull/ack" dos eventos acumulados pelo lado nativo.
 */
@CapacitorPlugin(
        name = "RoutineNative",
        permissions = {
            @Permission(strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}, alias = "background"),
            @Permission(strings = {"android.permission.POST_NOTIFICATIONS"}, alias = "notifications")
        })
public class RoutineNativePlugin extends Plugin {

    private JSObject granted(boolean value) {
        JSObject r = new JSObject();
        r.put("granted", value);
        return r;
    }

    // ------------------------------------------------------------------ status / permissões

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("fine", Perm.hasFine(c));
        r.put("coarse", Perm.hasCoarse(c));
        r.put("background", Perm.hasBackground(c));
        r.put("notifications", Perm.hasNotificationPermission(c) && NotificationManagerCompat.from(c).areNotificationsEnabled());

        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        r.put("locationEnabled", lm != null && LocationManagerCompat.isLocationEnabled(lm));

        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean unrestricted = pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        r.put("batteryUnrestricted", unrestricted);

        r.put("paused", NativeStore.paused(c));
        r.put("geofences", NativeStore.geofenceCount(c));
        r.put("lastSampleTs", NativeStore.lastSampleTs(c));
        r.put("lastEventTs", NativeStore.lastEventTs(c));
        r.put("lastSync", NativeStore.lastSync(c));
        r.put("lastError", NativeStore.lastError(c));
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void requestBackground(PluginCall call) {
        Context c = getContext();
        if (Perm.hasBackground(c)) {
            call.resolve(granted(true));
            return;
        }
        if (!Perm.hasFine(c)) {
            call.reject("Conceda a permiss\u00E3o de localiza\u00E7\u00E3o primeiro.");
            return;
        }
        requestPermissionForAlias("background", call, "backgroundResult");
    }

    @PermissionCallback
    private void backgroundResult(PluginCall call) {
        call.resolve(granted(Perm.hasBackground(getContext())));
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Perm.hasNotificationPermission(getContext())) {
            call.resolve(granted(true));
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsResult");
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        call.resolve(granted(Perm.hasNotificationPermission(getContext())));
    }

    private void launch(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        launch(i);
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            launch(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        } catch (Exception e) {
            launch(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        launch(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        call.resolve();
    }

    // ------------------------------------------------------------------ lugares / configuração

    @PluginMethod
    public void setPlaces(final PluginCall call) {
        JSArray places = call.getArray("places");
        if (places == null) {
            call.reject("Par\u00E2metro 'places' ausente");
            return;
        }
        Context c = getContext();
        NativeStore.setPlaces(c, places);
        Notifier.refreshStatus(c);
        GeofenceHelper.sync(c, new GeofenceHelper.Done() {
            @Override
            public void onDone(int count, String message) {
                JSObject r = new JSObject();
                r.put("registered", count);
                r.put("message", message);
                call.resolve(r);
            }
        });
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        Context c = getContext();
        NativeStore.setConfig(
                c,
                call.getInt("discoveryMin", 120),
                call.getInt("summaryHour", 22),
                call.getBoolean("summaryOn", true),
                call.getBoolean("statusOn", true));
        Notifier.refreshStatus(c);
        if (!NativeStore.paused(c)) Scheduler.scheduleSummary(c, 0);
        call.resolve();
    }

    /** Liga o rastreamento (workers + canais de notificação). Seguro chamar a cada abertura. */
    @PluginMethod
    public void start(PluginCall call) {
        Context c = getContext();
        Notifier.ensureChannels(c);
        if (!NativeStore.paused(c)) Scheduler.ensure(c);
        Notifier.refreshStatus(c);
        call.resolve();
    }

    @PluginMethod
    public void setPaused(final PluginCall call) {
        final Context c = getContext();
        boolean paused = call.getBoolean("paused", false);
        NativeStore.setPaused(c, paused);
        if (paused) {
            Scheduler.cancelAll(c);
            Notifier.cancelStatus(c);
            GeofenceHelper.clear(c, new GeofenceHelper.Done() {
                @Override
                public void onDone(int count, String message) {
                    call.resolve();
                }
            });
        } else {
            Scheduler.ensure(c);
            GeofenceHelper.sync(c, new GeofenceHelper.Done() {
                @Override
                public void onDone(int count, String message) {
                    Notifier.refreshStatus(c);
                    call.resolve();
                }
            });
        }
    }

    // ------------------------------------------------------------------ pull / ack

    @PluginMethod
    public void pull(PluginCall call) {
        JSONObject data = NativeStore.pull(getContext());
        JSObject r = new JSObject();
        try {
            r.put("epoch", data.getString("epoch"));
            r.put("events", new JSArray(data.getJSONArray("events").toString()));
            r.put("samples", new JSArray(data.getJSONArray("samples").toString()));
            r.put("ignored", new JSArray(data.getJSONArray("ignored").toString()));
        } catch (JSONException e) {
            call.reject("Falha ao ler o armazenamento nativo", e);
            return;
        }
        call.resolve(r);
    }

    @PluginMethod
    public void ack(PluginCall call) {
        Long e = call.getLong("eventSeq", 0L);
        Long s = call.getLong("sampleSeq", 0L);
        NativeStore.ack(getContext(), e == null ? 0L : e, s == null ? 0L : s);
        call.resolve();
    }
}
