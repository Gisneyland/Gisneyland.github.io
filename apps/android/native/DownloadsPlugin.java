package io.github.gisneyland.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "Downloads")
public class DownloadsPlugin extends Plugin {
    private static final String DOWNLOAD_SCRIPT =
        "(function(){if(window.__gisneylandBlobDownloads)return;window.__gisneylandBlobDownloads=true;" +
        "document.addEventListener('click',function(event){" +
        "var target=event.target;var link=target instanceof Element?target.closest('a[download][href^=\"blob:\"]'):null;" +
        "var plugin=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Downloads;" +
        "if(!link||!plugin)return;event.preventDefault();event.stopImmediatePropagation();" +
        "fetch(link.href).then(function(response){return response.blob()}).then(function(blob){" +
        "var reader=new FileReader();reader.onload=function(){" +
        "plugin.save({filename:link.download||'download',data:String(reader.result).split(',')[1]})" +
        ".catch(function(error){console.error('Could not save export',error)})};" +
        "reader.onerror=function(){console.error('Could not read export')};reader.readAsDataURL(blob)" +
        "}).catch(function(error){console.error('Could not read export',error)});" +
        "},true)})()";

    @Override
    public void load() {
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                String pageUrl = webView.getUrl();
                if (pageUrl != null) {
                    Uri pageUri = Uri.parse(pageUrl);
                    if ("https".equals(pageUri.getScheme()) && "gisneyland.github.io".equals(pageUri.getHost())) {
                        webView.evaluateJavascript(DOWNLOAD_SCRIPT, null);
                    }
                }
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String encodedData = call.getString("data");
        if (filename == null || encodedData == null) {
            call.reject("A filename and file data are required");
            return;
        }

        filename = new File(filename).getName().replaceAll("[^A-Za-z0-9._-]", "_");
        if (filename.isEmpty() || filename.equals(".") || filename.equals("..")) {
            call.reject("Invalid filename");
            return;
        }

        try {
            if (encodedData.length() > 35 * 1024 * 1024) {
                call.reject("Export exceeds the 25 MB size limit");
                return;
            }
            byte[] data = Base64.decode(encodedData, Base64.DEFAULT);
            if (data.length > 25 * 1024 * 1024) {
                call.reject("Export exceeds the 25 MB size limit");
                return;
            }
            String mimeType = getMimeType(filename);
            Uri savedUri = saveFile(filename, mimeType, data);
            JSObject result = new JSObject();
            result.put("uri", savedUri.toString());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to save export", exception);
        }
    }

    private Uri saveFile(String filename, String mimeType, byte[] data) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Could not create download");
            }
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) {
                    throw new IllegalStateException("Could not open download");
                }
                output.write(data);
            } catch (Exception exception) {
                resolver.delete(uri, null, null);
                throw exception;
            }
            ContentValues completedValues = new ContentValues();
            completedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, completedValues, null, null);
            return uri;
        }

        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) {
            throw new IllegalStateException("Downloads directory is unavailable");
        }
        File file = new File(directory, filename);
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(data);
        }
        return Uri.fromFile(file);
    }

    private String getMimeType(String filename) {
        String lowerName = filename.toLowerCase(java.util.Locale.ROOT);
        if (lowerName.endsWith(".ics")) {
            return "text/calendar";
        }
        if (lowerName.endsWith(".csv")) {
            return "text/csv";
        }
        if (lowerName.endsWith(".xlsx")) {
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        return "application/octet-stream";
    }
}
