package app.routinetracker;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Detecta, em segundo plano, uma permanência longa fora de qualquer lugar cadastrado e
 * avisa ("quer cadastrar este lugar?"). Só cobre o caso de UMA estadia longa; o agrupamento de
 * várias visitas curtas aparece na aba Lugares, calculado pelo app.
 */
final class Discovery {
    private static final double CLUSTER_RADIUS_M = 200;
    private static final long MAX_GAP_MS = 60L * 60 * 1000;

    private Discovery() {}

    static void check(Context c, long ts, double lat, double lng, float acc) {
        if (acc > 300f) return;
        long needMinutes = NativeStore.discoveryMin(c);

        // Dentro de um lugar cadastrado (com folga de 30 m)? Então não há o que descobrir.
        JSONArray places = NativeStore.places(c);
        for (int i = 0; i < places.length(); i++) {
            JSONObject p = places.optJSONObject(i);
            if (p == null) continue;
            double d = Geo.distance(lat, lng, p.optDouble("lat"), p.optDouble("lng"));
            if (d <= p.optDouble("r", 150) + 30) return;
        }

        // Anda para trás nas amostras enquanto continuarem perto e sem grandes lacunas.
        JSONArray recent = NativeStore.recent(c);
        long start = ts;
        long prev = ts;
        for (int i = recent.length() - 1; i >= 0; i--) {
            JSONObject s = recent.optJSONObject(i);
            if (s == null) continue;
            long t = s.optLong("ts");
            if (t >= ts) continue; // a própria amostra recém-gravada
            if (Geo.distance(lat, lng, s.optDouble("lat"), s.optDouble("lng")) > CLUSTER_RADIUS_M) break;
            if (prev - t > MAX_GAP_MS) break;
            start = t;
            prev = t;
        }
        long minutes = (ts - start) / 60000L;
        if (minutes < needMinutes) return;
        if (NativeStore.isIgnored(c, lat, lng)) return;
        if (NativeStore.wasNotifiedRecently(c, lat, lng, ts)) return;

        NativeStore.markNotified(c, lat, lng, ts);
        Notifier.postDiscovery(c, lat, lng, minutes);
    }
}
