/* Injects the shared MyMap header into <div id="app-header"></div>.
   Brand links back to the gallery (index.html). */
(function(){
 var LOGO='assets/favicon-128.png';
 var el=document.getElementById('app-header');
 if(!el) return;
 el.className='app-header';
 el.innerHTML='<a class="brand" href="index.html" title="MyMap">'
   +'<img src="'+LOGO+'" alt="">'
   +'<span>MyMap</span></a>'
   +'<span class="sep"></span>';
}());
