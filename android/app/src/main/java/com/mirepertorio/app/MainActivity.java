package com.mirepertorio.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"appassets.androidplatform.net".equals(uri.getHost())) {
                    return super.shouldInterceptRequest(view, request);
                }

                String path = uri.getPath();
                if (path == null || "/".equals(path)) path = "/index.html";
                if (path.contains("..")) return null;

                String assetPath = "public" + path;
                try {
                    InputStream stream = getAssets().open(assetPath);
                    String mimeType = URLConnection.guessContentTypeFromName(assetPath);
                    if (assetPath.endsWith(".js")) mimeType = "text/javascript";
                    if (assetPath.endsWith(".css")) mimeType = "text/css";
                    if (mimeType == null) mimeType = "application/octet-stream";
                    String encoding = mimeType.startsWith("text/") ? "UTF-8" : null;
                    return new WebResourceResponse(mimeType, encoding, stream);
                } catch (IOException error) {
                    return null;
                }
            }
        });
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        WebView webView = (WebView) ((android.view.ViewGroup) findViewById(android.R.id.content)).getChildAt(0);
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
