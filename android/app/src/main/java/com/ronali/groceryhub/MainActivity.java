package com.ronali.groceryhub;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String HOME_ROUTE = "/tabs/home";
    private static final String BACK_NAVIGATION_SCRIPT =
        "(function() {" +
        "  const home = '" + HOME_ROUTE + "';" +
        "  const normalizedPath = location.pathname.length > 1 && location.pathname.endsWith('/')" +
        "    ? location.pathname.slice(0, -1)" +
        "    : location.pathname;" +
        "  if (normalizedPath === home) {" +
        "    return 'exit';" +
        "  }" +
        "  if (window.history.length > 1) {" +
        "    window.history.back();" +
        "    return 'back';" +
        "  }" +
        "  window.location.replace(home);" +
        "  return 'home';" +
        "})()";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (bridge == null || bridge.getWebView() == null) {
                        finish();
                        return;
                    }

                    bridge
                        .getWebView()
                        .evaluateJavascript(
                            BACK_NAVIGATION_SCRIPT,
                            result -> {
                                if ("\"exit\"".equals(result)) {
                                    finish();
                                }
                            }
                        );
                }
            }
        );
    }
}
