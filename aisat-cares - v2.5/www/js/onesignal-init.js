document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {

    window.plugins.OneSignal.Debug.setLogLevel(6);
    window.plugins.OneSignal.initialize('31f743ae-2b8b-4043-83f8-04d49ceb147f');
    window.plugins.OneSignal.Notifications.requestPermission(false).then((accepted) => {
      console.log("User accepted notifications: " + accepted);
    });
  
}