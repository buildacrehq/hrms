package in.buildacre.hrms;

import android.Manifest;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSettingsPlugin.class);
        super.onCreate(savedInstanceState);

        // Request camera and location permissions upfront on first launch
        ActivityCompat.requestPermissions(this, new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        }, 100);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
        } else {
            // At root — send to background instead of closing the app
            moveTaskToBack(true);
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Extend Capacitor's WebChromeClient to pass camera + location
        // permission requests through to the web page automatically
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant camera / microphone access requested by getUserMedia
                request.grant(request.getResources());
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Grant location access to the web page
                callback.invoke(origin, true, false);
            }
        });
    }
}
