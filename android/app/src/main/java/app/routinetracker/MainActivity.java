package app.routinetracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O plugin local precisa ser registrado ANTES do super.onCreate.
        registerPlugin(RoutineNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
