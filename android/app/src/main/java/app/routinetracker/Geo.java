package app.routinetracker;

/** Distância haversine em metros (mesma fórmula do lado TypeScript). */
final class Geo {
    private Geo() {}

    static double distance(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6371008.8;
        final double rad = Math.PI / 180.0;
        double dLat = (lat2 - lat1) * rad;
        double dLon = (lon2 - lon1) * rad;
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
