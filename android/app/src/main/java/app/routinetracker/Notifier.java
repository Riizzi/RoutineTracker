package app.routinetracker;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class Notifier {
    static final String CH_STATUS = "status";
    static final String CH_DISCOVERY = "descoberta";
    static final String CH_SUMMARY = "resumo";
    static final int ID_STATUS = 1001;
    static final int ID_SUMMARY = 3001;

    private Notifier() {}

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel status =
                new NotificationChannel(CH_STATUS, "Lugar atual", NotificationManager.IMPORTANCE_LOW);
        status.setDescription("Mostra em que lugar cadastrado voc\u00EA est\u00E1 agora");
        status.setShowBadge(false);
        nm.createNotificationChannel(status);

        NotificationChannel discovery =
                new NotificationChannel(CH_DISCOVERY, "Lugares novos", NotificationManager.IMPORTANCE_DEFAULT);
        discovery.setDescription("Pergunta se voc\u00EA quer cadastrar um lugar onde passou muito tempo");
        nm.createNotificationChannel(discovery);

        NotificationChannel summary =
                new NotificationChannel(CH_SUMMARY, "Resumo do dia", NotificationManager.IMPORTANCE_DEFAULT);
        summary.setDescription("Resumo di\u00E1rio do tempo em cada lugar");
        nm.createNotificationChannel(summary);
    }

    private static PendingIntent openApp(Context c, Uri data, int requestCode) {
        Intent i;
        if (data != null) {
            i = new Intent(Intent.ACTION_VIEW, data);
            i.setPackage(c.getPackageName());
        } else {
            i = new Intent(c, MainActivity.class);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @SuppressLint("MissingPermission")
    private static void post(Context c, int id, Notification n) {
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(c);
            if (nm.areNotificationsEnabled()) nm.notify(id, n);
        } catch (SecurityException ignored) {
            // permissão de notificação revogada entre a checagem e o envio
        }
    }

    /** Notificação discreta e persistente com o lugar atual (ou "fora dos lugares cadastrados"). */
    static void refreshStatus(Context ctx) {
        Context c = ctx.getApplicationContext();
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        if (!NativeStore.statusOn(c) || NativeStore.paused(c)) {
            nm.cancel(ID_STATUS);
            return;
        }
        ensureChannels(c);
        String cur = NativeStore.currentName(c);
        String title;
        String text;
        if (cur != null) {
            title = "\uD83D\uDCCD " + cur;
            text = "Desde " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(NativeStore.currentSince(c)));
        } else {
            title = "RoutineTracker ativo";
            text = "Fora dos lugares cadastrados";
        }
        Notification n = new NotificationCompat.Builder(c, CH_STATUS)
                .setSmallIcon(R.drawable.ic_stat_pin)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(openApp(c, null, 0))
                .build();
        post(c, ID_STATUS, n);
    }

    static void cancelStatus(Context c) {
        NotificationManagerCompat.from(c).cancel(ID_STATUS);
    }

    static void postDiscovery(Context ctx, double lat, double lng, long minutes) {
        Context c = ctx.getApplicationContext();
        ensureChannels(c);
        int id = 2000 + (int) (Math.abs(Math.round(lat * 1000) * 31 + Math.round(lng * 1000)) % 900);
        // Locale.US: em pt-BR o formato padrão usaria vírgula decimal e quebraria a URL.
        Uri uri = Uri.parse(String.format(Locale.US, "routinetracker://novo-lugar?lat=%.6f&lng=%.6f", lat, lng));

        Intent ignore = new Intent(c, ActionReceiver.class);
        ignore.setAction(ActionReceiver.ACTION_IGNORE);
        ignore.putExtra("lat", lat);
        ignore.putExtra("lng", lng);
        ignore.putExtra("nid", id);
        PendingIntent ignorePi = PendingIntent.getBroadcast(
                c, id, ignore, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String dur = NativeStore.fmtMinutes(minutes);
        String body = "Voc\u00EA est\u00E1 h\u00E1 " + dur + " num lugar que n\u00E3o est\u00E1 cadastrado. Quer cadastr\u00E1-lo?";
        Notification n = new NotificationCompat.Builder(c, CH_DISCOVERY)
                .setSmallIcon(R.drawable.ic_stat_pin)
                .setContentTitle("Novo lugar frequente?")
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(openApp(c, uri, id))
                .addAction(0, "Cadastrar", openApp(c, uri, id))
                .addAction(0, "Ignorar", ignorePi)
                .build();
        post(c, id, n);
    }

    static void postSummary(Context ctx, String text) {
        Context c = ctx.getApplicationContext();
        ensureChannels(c);
        Notification n = new NotificationCompat.Builder(c, CH_SUMMARY)
                .setSmallIcon(R.drawable.ic_stat_pin)
                .setContentTitle("Resumo do dia")
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(openApp(c, null, 3))
                .build();
        post(c, ID_SUMMARY, n);
    }
}
