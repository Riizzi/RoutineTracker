package app.routinetracker;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Persistência nativa (SharedPreferences) usada por receivers/workers, que rodam mesmo com o
 * app fechado — nesses momentos o JavaScript não existe. O JS "puxa" (pull) o que se acumulou.
 *
 * Todo acesso é serializado por LOCK e gravado com commit() (o processo pode morrer logo
 * depois de um receiver terminar).
 */
final class NativeStore {
    private static final String PREFS = "rt_native";
    private static final Object LOCK = new Object();
    private static final int MAX_EVENTS = 2000;
    private static final int MAX_SAMPLES = 2000;
    private static final int MAX_RECENT = 96;

    private NativeStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ JSON helpers

    private static JSONArray arr(SharedPreferences p, String key) {
        String s = p.getString(key, null);
        if (s == null) return new JSONArray();
        try {
            return new JSONArray(s);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject obj(SharedPreferences p, String key) {
        String s = p.getString(key, null);
        if (s == null) return new JSONObject();
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static JSONArray tail(JSONArray a, int max) {
        if (a.length() <= max) return a;
        JSONArray out = new JSONArray();
        for (int i = a.length() - max; i < a.length(); i++) out.put(a.opt(i));
        return out;
    }

    private static void put(JSONObject o, String k, Object v) {
        try {
            o.put(k, v);
        } catch (JSONException ignored) {
            // só falha com chave nula
        }
    }

    // ------------------------------------------------------------------ epoch / diagnóstico

    /** Identifica esta instalação do armazenamento; se mudar, o JS zera seus cursores. */
    static String epoch(Context c) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            String e = p.getString("epoch", null);
            if (e == null) {
                e = UUID.randomUUID().toString();
                p.edit().putString("epoch", e).commit();
            }
            return e;
        }
    }

    static void setLastSync(Context c, String msg, int count) {
        synchronized (LOCK) {
            prefs(c).edit().putString("lastSync", msg).putInt("geofences", count).commit();
        }
    }

    static void setLastError(Context c, String msg) {
        synchronized (LOCK) {
            prefs(c).edit().putString("lastError", msg + " @" + System.currentTimeMillis()).commit();
        }
    }

    static String lastSync(Context c) {
        synchronized (LOCK) {
            return prefs(c).getString("lastSync", "");
        }
    }

    static String lastError(Context c) {
        synchronized (LOCK) {
            return prefs(c).getString("lastError", "");
        }
    }

    static int geofenceCount(Context c) {
        synchronized (LOCK) {
            return prefs(c).getInt("geofences", 0);
        }
    }

    static long lastSampleTs(Context c) {
        synchronized (LOCK) {
            return prefs(c).getLong("lastSampleTs", 0L);
        }
    }

    static long lastEventTs(Context c) {
        synchronized (LOCK) {
            return prefs(c).getLong("lastEventTs", 0L);
        }
    }

    // ------------------------------------------------------------------ configuração

    static int discoveryMin(Context c) {
        synchronized (LOCK) {
            return prefs(c).getInt("cfgDiscoveryMin", 120);
        }
    }

    static int summaryHour(Context c) {
        synchronized (LOCK) {
            return prefs(c).getInt("cfgSummaryHour", 22);
        }
    }

    static boolean summaryOn(Context c) {
        synchronized (LOCK) {
            return prefs(c).getBoolean("cfgSummaryOn", true);
        }
    }

    static boolean statusOn(Context c) {
        synchronized (LOCK) {
            return prefs(c).getBoolean("cfgStatusOn", true);
        }
    }

    static boolean paused(Context c) {
        synchronized (LOCK) {
            return prefs(c).getBoolean("paused", false);
        }
    }

    static void setPaused(Context c, boolean paused) {
        synchronized (LOCK) {
            prefs(c).edit().putBoolean("paused", paused).commit();
        }
    }

    static void setConfig(Context c, int discoveryMin, int summaryHour, boolean summaryOn, boolean statusOn) {
        synchronized (LOCK) {
            prefs(c).edit()
                    .putInt("cfgDiscoveryMin", Math.max(15, discoveryMin))
                    .putInt("cfgSummaryHour", Math.min(23, Math.max(0, summaryHour)))
                    .putBoolean("cfgSummaryOn", summaryOn)
                    .putBoolean("cfgStatusOn", statusOn)
                    .commit();
        }
    }

    // ------------------------------------------------------------------ lugares

    static JSONArray places(Context c) {
        synchronized (LOCK) {
            return arr(prefs(c), "places");
        }
    }

    /** Substitui a lista de lugares [{id,name,lat,lng,r}] e reconcilia o estado "dentro de". */
    static void setPlaces(Context c, JSONArray places) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            SharedPreferences.Editor ed = p.edit();
            ed.putString("places", places.toString());

            JSONObject inside = obj(p, "inside");
            List<String> stale = new ArrayList<>();
            Iterator<String> keys = inside.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                boolean found = false;
                for (int i = 0; i < places.length(); i++) {
                    JSONObject pl = places.optJSONObject(i);
                    if (pl != null && id.equals(pl.optString("id"))) {
                        found = true;
                        break;
                    }
                }
                if (!found) stale.add(id);
            }
            for (String id : stale) inside.remove(id);
            ed.putString("inside", inside.toString());
            switchCurrent(p, ed, inside, places, System.currentTimeMillis());
            ed.commit();
        }
    }

    // ------------------------------------------------------------------ transições de geofence

    static void recordTransition(Context c, String type, String placeId, long ts, double lat, double lng) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            SharedPreferences.Editor ed = p.edit();
            long seq = p.getLong("seq", 0L) + 1;
            ed.putLong("seq", seq);

            JSONObject e = new JSONObject();
            put(e, "seq", seq);
            put(e, "type", type);
            put(e, "placeId", placeId);
            put(e, "ts", ts);
            if (!Double.isNaN(lat) && !Double.isNaN(lng)) {
                put(e, "lat", lat);
                put(e, "lng", lng);
            }
            JSONArray events = arr(p, "events");
            events.put(e);
            ed.putString("events", tail(events, MAX_EVENTS).toString());
            ed.putLong("lastEventTs", ts);

            JSONObject inside = obj(p, "inside");
            if ("ENTER".equals(type)) {
                if (!inside.has(placeId)) put(inside, placeId, ts);
            } else {
                inside.remove(placeId);
            }
            ed.putString("inside", inside.toString());
            switchCurrent(p, ed, inside, arr(p, "places"), ts);
            ed.commit();
        }
    }

    // ------------------------------------------------------------------ amostras

    static void addSample(Context c, long ts, double lat, double lng, float acc) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            SharedPreferences.Editor ed = p.edit();
            long seq = p.getLong("seq", 0L) + 1;
            ed.putLong("seq", seq);

            JSONObject s = new JSONObject();
            put(s, "seq", seq);
            put(s, "ts", ts);
            put(s, "lat", lat);
            put(s, "lng", lng);
            put(s, "acc", (double) acc);
            JSONArray samples = arr(p, "samples");
            samples.put(s);
            ed.putString("samples", tail(samples, MAX_SAMPLES).toString());

            if (acc <= 300f) {
                JSONArray recent = arr(p, "recent");
                recent.put(s);
                ed.putString("recent", tail(recent, MAX_RECENT).toString());
            }
            ed.putLong("lastSampleTs", ts);
            ed.commit();
        }
    }

    static JSONArray recent(Context c) {
        synchronized (LOCK) {
            return arr(prefs(c), "recent");
        }
    }

    // ------------------------------------------------------------------ pull / ack (ponte com o JS)

    static JSONObject pull(Context c) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONObject out = new JSONObject();
            put(out, "epoch", epoch(c));
            put(out, "events", arr(p, "events"));
            put(out, "samples", arr(p, "samples"));
            put(out, "ignored", arr(p, "ignored"));
            return out;
        }
    }

    static void ack(Context c, long eventSeq, long sampleSeq) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            SharedPreferences.Editor ed = p.edit();
            ed.putString("events", keepAfter(arr(p, "events"), eventSeq).toString());
            ed.putString("samples", keepAfter(arr(p, "samples"), sampleSeq).toString());
            ed.commit();
        }
    }

    private static JSONArray keepAfter(JSONArray a, long seq) {
        JSONArray out = new JSONArray();
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null && o.optLong("seq", 0L) > seq) out.put(o);
        }
        return out;
    }

    // ------------------------------------------------------------------ descoberta: ignorados / já avisados

    static void addIgnored(Context c, double lat, double lng) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONArray a = arr(p, "ignored");
            JSONObject o = new JSONObject();
            put(o, "lat", lat);
            put(o, "lng", lng);
            a.put(o);
            p.edit().putString("ignored", tail(a, 200).toString()).commit();
        }
    }

    static boolean isIgnored(Context c, double lat, double lng) {
        synchronized (LOCK) {
            JSONArray a = arr(prefs(c), "ignored");
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && Geo.distance(o.optDouble("lat"), o.optDouble("lng"), lat, lng) <= 200) return true;
            }
            return false;
        }
    }

    static boolean wasNotifiedRecently(Context c, double lat, double lng, long now) {
        synchronized (LOCK) {
            JSONArray a = arr(prefs(c), "notified");
            long week = 7L * 24 * 3600 * 1000;
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o == null) continue;
                if (now - o.optLong("ts") < week
                        && Geo.distance(o.optDouble("lat"), o.optDouble("lng"), lat, lng) <= 250) {
                    return true;
                }
            }
            return false;
        }
    }

    static void markNotified(Context c, double lat, double lng, long now) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONArray a = arr(p, "notified");
            JSONObject o = new JSONObject();
            put(o, "lat", lat);
            put(o, "lng", lng);
            put(o, "ts", now);
            a.put(o);
            p.edit().putString("notified", tail(a, 30).toString()).commit();
        }
    }

    // ------------------------------------------------------------------ lugar atual + totais do dia

    /**
     * Credita o tempo decorrido ao lugar "efetivo" anterior (o de menor raio dentre os que
     * contêm a pessoa — mesma regra do TypeScript) e elege o novo. Chamar dentro de LOCK.
     */
    private static void switchCurrent(
            SharedPreferences p, SharedPreferences.Editor ed, JSONObject inside, JSONArray places, long now) {
        String oldCur = p.getString("cur", null);
        long since = p.getLong("curSince", now);
        JSONObject totals = obj(p, "totals");
        if (oldCur != null && since < now) credit(totals, oldCur, since, now);

        String best = null;
        double bestR = 0;
        long bestT = 0;
        for (int i = 0; i < places.length(); i++) {
            JSONObject pl = places.optJSONObject(i);
            if (pl == null) continue;
            String id = pl.optString("id");
            if (!inside.has(id)) continue;
            double r = pl.optDouble("r", 150);
            long t = inside.optLong(id, now);
            if (best == null || r < bestR || (r == bestR && t < bestT)) {
                best = id;
                bestR = r;
                bestT = t;
            }
        }
        if (best == null) ed.remove("cur");
        else ed.putString("cur", best);
        ed.putLong("curSince", now);
        ed.putString("totals", prune(totals, now).toString());
    }

    private static String dayKey(Calendar cal) {
        return String.format(
                Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
    }

    /** Soma minutos por dia local, dividindo nas meias-noites. */
    private static void credit(JSONObject totals, String placeId, long from, long to) {
        Calendar cal = Calendar.getInstance();
        long cursor = from;
        while (cursor < to) {
            cal.setTimeInMillis(cursor);
            String day = dayKey(cal);
            cal.set(Calendar.HOUR_OF_DAY, 0);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            cal.add(Calendar.DAY_OF_MONTH, 1);
            long end = Math.min(to, cal.getTimeInMillis());
            double mins = (end - cursor) / 60000.0;
            JSONObject d = totals.optJSONObject(day);
            if (d == null) {
                d = new JSONObject();
                put(totals, day, d);
            }
            put(d, placeId, d.optDouble(placeId, 0) + mins);
            cursor = end;
        }
    }

    private static JSONObject prune(JSONObject totals, long now) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.add(Calendar.DAY_OF_MONTH, -3);
        String min = dayKey(cal);
        JSONObject out = new JSONObject();
        Iterator<String> it = totals.keys();
        while (it.hasNext()) {
            String k = it.next();
            if (k.compareTo(min) >= 0) put(out, k, totals.opt(k));
        }
        return out;
    }

    private static String nameOf(JSONArray places, String id) {
        for (int i = 0; i < places.length(); i++) {
            JSONObject pl = places.optJSONObject(i);
            if (pl != null && id.equals(pl.optString("id"))) return pl.optString("name", "Lugar");
        }
        return null;
    }

    static String currentName(Context c) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            String cur = p.getString("cur", null);
            return cur == null ? null : nameOf(arr(p, "places"), cur);
        }
    }

    static long currentSince(Context c) {
        synchronized (LOCK) {
            return prefs(c).getLong("curSince", 0L);
        }
    }

    static String fmtMinutes(double minutes) {
        long m = Math.round(minutes);
        if (m < 60) return m + "min";
        long h = m / 60;
        long r = m % 60;
        return r == 0 ? h + "h" : String.format(Locale.US, "%dh%02d", h, r);
    }

    /** Texto do resumo de hoje ("Trabalho 8h20 · Casa 6h"), ou null se não há dados. */
    static String summaryText(Context c, long now) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONArray places = arr(p, "places");
            JSONObject totals = obj(p, "totals");
            String cur = p.getString("cur", null);
            long since = p.getLong("curSince", now);
            if (cur != null && since < now) credit(totals, cur, since, now); // parte ainda em aberto

            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(now);
            JSONObject today = totals.optJSONObject(dayKey(cal));
            if (today == null || today.length() == 0) return null;

            final List<String[]> rows = new ArrayList<>();
            Iterator<String> it = today.keys();
            while (it.hasNext()) {
                String id = it.next();
                double mins = today.optDouble(id, 0);
                String name = nameOf(places, id);
                if (name == null || mins < 5) continue;
                rows.add(new String[] {name, String.valueOf(mins)});
            }
            if (rows.isEmpty()) return null;
            Collections.sort(rows, new Comparator<String[]>() {
                @Override
                public int compare(String[] a, String[] b) {
                    return Double.compare(Double.parseDouble(b[1]), Double.parseDouble(a[1]));
                }
            });
            StringBuilder sb = new StringBuilder("Hoje: ");
            for (int i = 0; i < rows.size() && i < 4; i++) {
                if (i > 0) sb.append(" \u00B7 ");
                sb.append(rows.get(i)[0]).append(' ').append(fmtMinutes(Double.parseDouble(rows.get(i)[1])));
            }
            return sb.toString();
        }
    }
}
