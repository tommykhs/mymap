/* Injects the shared MyMaps header into <div id="app-header"></div>.
   Brand links back to the gallery (index.html). */
(function(){
 var LOGO='https://cdn.iconscout.com/icon/free/png-512/free-google-my-maps-logo-icon-svg-download-png-3955526.png';
 var el=document.getElementById('app-header');
 if(!el) return;
 el.className='app-header';
 el.innerHTML='<a class="brand" href="index.html" title="MyMaps">'
   +'<img src="'+LOGO+'" alt="">'
   +'<span>MyMaps</span></a>'
   +'<span class="sep"></span>';
}());
