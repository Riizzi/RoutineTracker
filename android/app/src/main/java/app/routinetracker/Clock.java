package app.routinetracker;

import java.util.Calendar;

final class Clock {
    private Clock() {}

    /** Milissegundos até a próxima ocorrência de `hour`:00 (nunca menos de 1 min: senão vira amanhã). */
    static long msUntilHour(int hour, long now) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long target = cal.getTimeInMillis();
        if (target - now < 60_000L) target += 24L * 3600 * 1000;
        return target - now;
    }
}
