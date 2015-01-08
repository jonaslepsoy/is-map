var mapData, canvas, ctx;
var dragStart,dragged;
var lastX, lastY;
var mousePos = {x:0,y:0};
var zoomLevel = 0.5;
var fontSize = 1.2;
var initialPlanetRadius = 1
var planetRadius = initialPlanetRadius / zoomLevel;
var offscreen_canvas, offscreen_context;
var sites = [];
var cells = null;
var bbox = {xl:-1000, xr:1000, yt:-1000, yb:1000};
var logoSize = 64;
var capitals = [];
var scaleFactor = 1.1;


$(document).ready(function(){
	
	canvas = document.getElementById('map');
	ctx = canvas.getContext('2d');
	$('#map').attr('width', $('#map').width() ); //max width
	$('#map').attr('height', $('#map').height() ); //max height
	offscreen_canvas = document.createElement('canvas');
	offscreen_canvas.width = canvas.width;
	offscreen_canvas.height = canvas.height;
	offscreen_context = offscreen_canvas.getContext('2d');

	$(window).resize(responsiveCanvas);
	responsiveCanvas();

	trackTransforms(ctx);
	trackTransforms(offscreen_context);

	getMapData('json/mapdata.json'); // For easier development...
	//getMapData('https://static.mwomercs.com/data/cw/mapdata.json');

	initCanvas();
})

function initCanvas(){
	//Initial viewport
	offscreen_context.translate(canvas.width / 2,canvas.height / 2);
	offscreen_context.scale(zoomLevel,zoomLevel);

	drawLines(offscreen_context);

	lastX=canvas.width/2, lastY=canvas.height/2;

	canvas.addEventListener('mousedown',function(evt){
		document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
		lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
		lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
		dragStart = offscreen_context.transformedPoint(lastX,lastY);
		dragged = false;
	},false);

	canvas.addEventListener('mousemove',function(evt){
		if(mapData) {
			var hovercell = getMousePos(canvas,evt);
			if(hovercell) {
				redraw(mapData); // Only redraw if needed (User is mousing over a planet)
				showDetails(mapData.cells[hovercell].site.planet);
			};
			lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
			lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
			dragged = true;
			if (dragStart){
				var pt = offscreen_context.transformedPoint(lastX,lastY);
				offscreen_context.translate(pt.x-dragStart.x,pt.y-dragStart.y);
				redraw(mapData);
			}
		}
	},false);

	canvas.addEventListener('mouseup',function(evt){
		dragStart = null;
		if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
	},false);

	canvas.addEventListener('DOMMouseScroll',handleScroll,false);
	canvas.addEventListener('mousewheel',handleScroll,false);
}

function zoom (clicks){
	var pt = offscreen_context.transformedPoint(lastX,lastY);
	offscreen_context.translate(pt.x,pt.y);
	var factor = Math.pow(scaleFactor,clicks);
	zoomLevel = offscreen_context.getTransform().a;
	if(zoomLevel > 1) {
		planetRadius = initialPlanetRadius;
	} else {
		planetRadius = initialPlanetRadius / zoomLevel;
	}
	offscreen_context.scale(factor,factor);
	offscreen_context.translate(-pt.x,-pt.y);
	redraw(mapData);
}

function handleScroll (evt){
	var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
	if (delta){
		if(zoomLevel > 0.4 || delta > 0) {
			zoom(delta);
		}
	}
	return evt.preventDefault() && false;
};

function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	mousePos = offscreen_context.transformedPoint(evt.clientX - rect.left, evt.clientY - rect.top);
	return trackHoverPlanet(mousePos);
}

function redraw(mapData){
    // Clear the entire canvas
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    offscreen_context.save();
    offscreen_context.setTransform(1,0,0,1,0,0);
    offscreen_context.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
    offscreen_context.restore();

	drawLines(offscreen_context);

    if(mapData) {
    	drawVoronoi(offscreen_context, mapData, sites);
    	ctx.drawImage(offscreen_canvas, 0, 0);
    	//requestAnimationFrame(redraw); // Hooo, this uses some cycles! Let's develop some more before we optimize any more.
    }
}

// Adds ctx.getTransform() - returns an SVGMatrix
// Adds ctx.transformedPoint(x,y) - returns an SVGPoint
function trackTransforms(ctx){
	var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
	var xform = svg.createSVGMatrix();
	ctx.getTransform = function(){ return xform; };

	var savedTransforms = [];
	var save = ctx.save;
	ctx.save = function(){
		savedTransforms.push(xform.translate(0,0));
		return save.call(ctx);
	};

	var restore = ctx.restore;
		ctx.restore = function(){
	    xform = savedTransforms.pop();
	    return restore.call(ctx);
	};

	var scale = ctx.scale;
		ctx.scale = function(sx,sy){
    	xform = xform.scaleNonUniform(sx,sy);
    	return scale.call(ctx,sx,sy);
	};

	var rotate = ctx.rotate;
		ctx.rotate = function(radians){
		xform = xform.rotate(radians*180/Math.PI);
		return rotate.call(ctx,radians);
	};

	var translate = ctx.translate;
		ctx.translate = function(dx,dy){
		xform = xform.translate(dx,dy);
		return translate.call(ctx,dx,dy);
	};

  	var transform = ctx.transform;
  	ctx.transform = function(a,b,c,d,e,f){
		var m2 = svg.createSVGMatrix();
		m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
		xform = xform.multiply(m2);
		return transform.call(ctx,a,b,c,d,e,f);
  	};

  	var setTransform = ctx.setTransform;
  	ctx.setTransform = function(a,b,c,d,e,f){
		xform.a = a;
		xform.b = b;
		xform.c = c;
		xform.d = d;
		xform.e = e;
		xform.f = f;
      	return setTransform.call(ctx,a,b,c,d,e,f);
  	};

  	var pt  = svg.createSVGPoint();
  	ctx.transformedPoint = function(x,y){
      pt.x=x; pt.y=y;
      return pt.matrixTransform(xform.inverse());
	}
}

var getMapData = function(url) {
	$('.loading-animation').show();

	var xmlhttp;
	if (window.XMLHttpRequest)
	{// code for IE7+, Firefox, Chrome, Opera, Safari
		xmlhttp=new XMLHttpRequest();
	}
	else
	{// code for IE6, IE5
		xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
	}

	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			$('.loading-animation').hide();
			mapData = jQuery.parseJSON(xmlhttp.responseText);
			data = mapData;
			$('#date').text('Generated: ' + data.generated);
			$('#date').data('date', data.generated);
			//Initialize data for our Voronoi diagram
			sites = [];
			$.each(mapData, function(){
				if(this.position && this.position.x && this.position.y){
					var site = {};
					site.x = parseInt(this.position.x);
					site.y = parseInt(this.position.y);
					site.planet = this;
					sites.push(site);
				}
				if(this.name==='Luthien' || this.name==='New Avalon' || this.name==='Atreus' || this.name==='Sian' || this.name==='Tharkad' || this.name==='Terra' || this.name==='Rasalhague' || this.name==='Richmond' || this.name==='Manaringaine' || this.name==='The Rock' || this.name==='Botany Bay'){
					capitals.push(this);
				}
			});
			var voronoi = new Voronoi();
			mapData = voronoi.compute(sites, bbox);
			cells = mapData.cells;
			//console.log(cells[0]);
			redraw(mapData);
		}
	}
	xmlhttp.open("GET",url,true);
	xmlhttp.send();
}

function writeMousePosition() {
	var message = 'Mouse position: ' + mousePos.x + ',' + mousePos.y + ', zoom: ' + zoomLevel;
	ctx.font = '12pt Calibri';
	ctx.fillStyle = 'white';
	ctx.fillText(message, 10, 25);
}


function responsiveCanvas(){ 
    $('#map').attr('width', $('#map').width() ); //max width
    $('#map').attr('height', $('#map').height() ); //max height
	redraw(mapData);
}

function drawLines(context) {
	// Let's create a radial gradient for our lines and circles
	var gradient = context.createRadialGradient(0, 0, 600, 0, 0, 1200);
	gradient.addColorStop(0, '#004CB3');
	gradient.addColorStop(1, '#000000');
	context.strokeStyle = gradient;
	context.lineWidth = 1 / zoomLevel;

	var sectors = 36; // How many segments in our starmap
	var r = 2600; // How far our should we draw the lines?

	context.beginPath();
	for(var i = 1; i <= sectors; i++) {
		// Draw some pretty lines. Doing it this way is more efficient than drawing all the lines from the edge of the circle, even though this method doubles the number of lines we draw.
		var x = r * Math.cos(2 * Math.PI * i / sectors);
		var y = r * Math.sin(2 * Math.PI * i / sectors);
		context.moveTo(0,0);
		context.lineTo(x,y);
	}
	for (var r = 200; r <= 2000; r+=200) {
		// Draw some pretty circles
		context.arc(0, 0, r, 0, 2 * Math.PI, false);
	}
	context.stroke();
	context.closePath();
}

function drawVoronoi(context, mapData) {
	var rect = canvas.getBoundingClientRect();
	var topleft = context.transformedPoint(0 - rect.left, 0 - rect.top);
	var bottomright = context.transformedPoint(canvas.width, canvas.height);
	if (!cells) {return;}
	var halfedges, nHalfedges, iHalfedge;
	var v;
	for (var cellid in cells) {
		halfedges = cells[cellid].halfedges;
		nHalfedges = halfedges.length;
		if(nHalfedges > 0 && cells[cellid].site.planet.owner.id != 0) { // Assert that we actually have some edges to draw. If not, try again. Who knows, maybe it might work?
			v = halfedges[0].getStartpoint();
			context.beginPath();
			context.moveTo(v.x,-v.y);
			for (iHalfedge=0; iHalfedge<nHalfedges; iHalfedge++) {
				v = halfedges[iHalfedge].getEndpoint();
				context.lineTo(v.x,-v.y);
			}
			context.fillStyle=getFactionColor(cells[cellid].site.planet);
			context.fill();
		}
	}

	var currentLogoSize = logoSize * zoomLevel;
	if(currentLogoSize < 64) currentLogoSize = 64;
	else if(currentLogoSize > logoSize) currentLogoSize = logoSize;
	context.globalAlpha = 1 / zoomLevel;
	$.each(capitals, function(){
		//console.log(this);
		var img=document.getElementById("logo" + this.owner.id);
		if(img) {
			context.drawImage(img,this.position.x - (currentLogoSize / 2),-this.position.y - (currentLogoSize / 2),currentLogoSize,currentLogoSize);
		}
	});
	//Remember to reset the alpha
	context.globalAlpha = 1;

	$.each(mapData.cells, function(){
		// First, let's draw all the planets inside the viewport
		if(
			this.site.planet.position &&
			this.site.planet.position.x &&
			this.site.planet.position.y &&
			this.site.planet.position.x > topleft.x &&
			this.site.planet.position.x < bottomright.x &&
			-this.site.planet.position.y > topleft.y &&
			-this.site.planet.position.y < bottomright.y) {
			context.beginPath();
			context.arc(this.site.planet.position.x, -this.site.planet.position.y, planetRadius, 0, 2 * Math.PI, false);
			context.fillStyle = getFactionPlanetColor(this.site.planet);
			context.fill();
			context.closePath();

			if(this.selected) {
				context.beginPath();
				context.arc(this.site.planet.position.x, -this.site.planet.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				context.strokeStyle = 'cyan';
				if(this.planet.contested != 0) {
					var sum = 0;
					for (var t = 0; t < 8; t++) {
						var territory = this.territories[t];
						for (var i = 0; i < 8; i++) {
							sum += (0x1 & territory);
							territory = territory >> 1;
						}
					}
					context.lineWidth = sum / 2 + 1;
				} else {
					context.lineWidth = 4;
				}
				context.stroke();
				context.closePath();
			}
		} else if (this.site.planet.name === 'Terra'){
			//console.log('not rendering Terra', this);
		}
	});

	context.font = (fontSize).toFixed(0) + 'px sans-serif';
	context.fillStyle = 'white';
	context.strokeStyle = 'black';
	context.lineWidth = 0.2;
	context.globalAlpha = (zoomLevel - 4) * 0.5;
	$.each(mapData.cells, function(){
		// Then, let's draw all planet names inside the viewport if we are zoomed in enough
		if(zoomLevel > 4 &&
			this.site.planet.position &&
			this.site.planet.position.x &&
			this.site.planet.position.y &&
			this.site.planet.position.x > parseInt(topleft.x) - 15 &&
			this.site.planet.position.x < bottomright.x &&
			-this.site.planet.position.y > topleft.y &&
			-this.site.planet.position.y < bottomright.y) {
			if(this.site.planet.selected) {
				context.font = (fontSize * 2).toFixed(0) + 'px sans-serif';
			}
			var planetText = this.site.planet.name;
			if(this.site.planet.unit.name!==''){
				planetText += ' (' + this.site.planet.unit.name + ')';
			}
			context.save();
			context.strokeText(planetText, parseInt(this.site.planet.position.x) + 3,parseInt(-this.site.planet.position.y) + 0.5);
			context.fillText(planetText, parseInt(this.site.planet.position.x) + 3,parseInt(-this.site.planet.position.y) + 0.5);
			context.restore();
			if(this.site.planet.selected) {
				context.font = (fontSize).toFixed(0) + 'px sans-serif';
			}
		}
	});
	context.globalAlpha = 1;
}

function getFactionColor(faction) {
	var factionID = faction.owner.id;
	//console.log(faction);
	if(faction.selected){
		return '#505050';
	}
	if(faction.contested != 0) {
		return '#aa0000';
	}
	if(factionID == 0) {
		return '#000000';
	} else if(factionID == 1) { // PIRANHA GAMES
		return '#dddddd';
	} else if(factionID == 2) { // NONE
		return '#dddddd';
	} else if(factionID == 3) { // NONE
		return '#dddddd';
	} else if(factionID == 4) { // NONE
		return '#dddddd';
	} else if(factionID == 5) { // DAVION
		return '#222200';
	} else if(factionID == 6) { // KURITA
		return '#220404';
	} else if(factionID == 7) { // LIAO
		return '#073315';
	} else if(factionID == 8) { // MARIK
		return '#111122';
	} else if(factionID == 9) { // RASALHAGUE
		return '#112222';
	} else if(factionID == 10) { // STEINER
		return '#001122';
	} else if(factionID == 11) { // SMOKE JAGUAR
		return '#112211';
	} else if(factionID == 12) { // JADE FALCON
		return '#1e3322';
	} else if(factionID == 13) { // WOLF
		return '#221e1e';
	} else if(factionID == 14) { // GHOST BEAR
		return '#223333';
	} else if(factionID == 15) { // NONE
		return '#ffffff';
	} else return '#ffffff';
}

function getFactionPlanetColor(faction) {
	var factionID = faction.owner.id;
	//console.log(faction);
	/*if(faction.contested != 0) {
		return '#aa0000';
	}*/
	if(factionID == 0) {
		return '#ffffff';
	} else if(factionID == 1) { // PIRANHA GAMES
		return '#ffffff';
	} else if(factionID == 2) { // NONE
		return '#ffffff';
	} else if(factionID == 3) { // NONE
		return '#ffffff';
	} else if(factionID == 4) { // NONE
		return '#ffffff';
	} else if(factionID == 5) { // DAVION
		return '#ffff33';
	} else if(factionID == 6) { // KURITA
		return '#ff3300';
	} else if(factionID == 7) { // LIAO
		return '#005000';
	} else if(factionID == 8) { // MARIK
		return '#cc00cc';
	} else if(factionID == 9) { // RASALHAGUE
		return '#00ccff';
	} else if(factionID == 10) { // STEINER
		return '#0033cc';
	} else if(factionID == 11) { // SMOKE JAGUAR
		return '#707070';
	} else if(factionID == 12) { // JADE FALCON
		return '#00cc33';
	} else if(factionID == 13) { // WOLF
		return '#cc0000';
	} else if(factionID == 14) { // GHOST BEAR
		return '#3399ff';
	} else if(factionID == 15) { // NONE
		return '#ffffff';
	} else return '#ffffff';
}

function trackHoverPlanet(mousePos) {
	//console.log(mousePos, mapData);
	var hoveringOverAPLanet = false;
    $.each(mapData.cells, function(index){
        if(this.site.planet.position && this.site.planet.position.x && this.site.planet.position.y) {
			if (pointInCell(mousePos, this) && !hoveringOverAPLanet) {
	            this.site.planet.selected = true;
				hoveringOverAPLanet = index;
	        } else {
	        	this.site.planet.selected = false;
	        }
	    }
    });
    return hoveringOverAPLanet;
}

function pointInCell(point, cell) {
	if (cell.pointIntersection(point.x,-point.y) > 0) {
		return true
	} else return false;
}

function showDetails (planet){
	// TODO: Replace with Angular or something like it. This is really rudimentary stuff, just to get something on screen...
	var owner = planet.owner.name;
	$('#planetname').text(planet.name);
	$('#planetowner').text(owner);
	if(planet.unit.name !== '') {
		owner = 'Unit: ' + planet.unit.name;
	} else owner = '';
	$('#planetownerunit').text(owner);
	$('#planetownerimage').attr('src',planet.owner.icon);
	$('#planetinvader').text(planet.invading.name);
	if(planet.invading.icon) {
		$('#planetinvaderimage').attr('src',planet.invading.icon);
		$('#planetinvaderimage').show();
	} else {
		$('#planetinvaderimage').hide();
	}
	if(planet.contested != 0) {
		// Calculate how many territories have been taken. Thanks to iamatotalnoob on Reddit (http://www.reddit.com/u/iamatotalnoob) for the algorithm
		var sum = 0;
		for (var t = 0; t < 8; t++) {
			var territory = planet.territories[t];
			for (var i = 0; i < 8; i++) {
				sum += (0x1 & territory);
				territory = territory >> 1;
			}
		}
		$('#planetinvaderterritoriesowned').children('.progress-bar').css('width',sum * 100 / 12+ '%').text(sum);
	} else {
		$('#planetinvaderterritoriesowned').children('.progress-bar').css('width','0%').text(0);
	}
	
}