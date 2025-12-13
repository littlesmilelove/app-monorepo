package so.onekey.app.wallet;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Debug;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

/**
 * PerfMemoryModule
 *
 * Exposes process memory usage to JS for performance monitoring.
 * Android uses PSS as a better approximation of real memory usage than RSS.
 * We map it to "rss" field (bytes) to keep the shared event schema stable.
 */
public class PerfMemoryModule extends ReactContextBaseJavaModule {

    public PerfMemoryModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "PerfMemoryModule";
    }

    @ReactMethod
    public void getMemoryUsage(Promise promise) {
        try {
            ActivityManager am = (ActivityManager) getReactApplicationContext()
                    .getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) {
                promise.resolve(null);
                return;
            }

            int pid = android.os.Process.myPid();
            Debug.MemoryInfo[] memInfos = am.getProcessMemoryInfo(new int[]{pid});
            if (memInfos == null || memInfos.length == 0) {
                promise.resolve(null);
                return;
            }

            // totalPss is in KB.
            long pssBytes = ((long) memInfos[0].getTotalPss()) * 1024L;

            WritableMap map = Arguments.createMap();
            map.putDouble("rss", (double) pssBytes);
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("PERF_MEMORY_ERROR", e);
        }
    }
}

