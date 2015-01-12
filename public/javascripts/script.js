var mapData, canvas, ctx;
var dragStart,dragged;
var lastX, lastY;
var mousePos = {x:0,y:0};
var zoomLevel = 0.5;
var fontSize = 1.2;
var initialPlanetRadius = 1
var planetRadius = initialPlanetRadius / zoomLevel;
var lastSelectedPlanet;
var offscreen_canvas, offscreen_context;
var sites = [];
var cells = null;
var bbox = {xl:-1000, xr:1000, yt:-1000, yb:1000};
var logoSize = 64;
var capitals = [];
var scaleFactor = 1.1;
var factionColor = [];
var factionPlanetColor = [];
var lastScale = null;

factionColor['selected'] = '#505050';
factionColor['contested'] = '#aa0000';
factionColor[0] =' #000000';
factionColor[5] =' #222200';
factionColor[6] =' #220404';
factionColor[7] =' #073315';
factionColor[8] =' #111122';
factionColor[9] =' #112222';
factionColor[10] =' #001122';
factionColor[11] =' #112211';
factionColor[12] =' #1e3322';
factionColor[13] =' #223333';
factionColor[14] =' #223333';

factionPlanetColor[0] = '#ffffff';
factionPlanetColor[5] = '#ffff33';
factionPlanetColor[6] = '#ff3300';
factionPlanetColor[7] = '#005000';
factionPlanetColor[8] = '#cc00cc';
factionPlanetColor[9] = '#00ccff';
factionPlanetColor[10] = '#0033cc';
factionPlanetColor[11] = '#707070';
factionPlanetColor[12] = '#00cc33';
factionPlanetColor[13] = '#cc0000';
factionPlanetColor[14] = '#3399ff';


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

	getMapData('json/mapdata.json');
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
			var reasonForRedraw = false;
			var hovercell = getMousePos(canvas,evt);
			if(!(hovercell === lastSelectedPlanet)){
				lastSelectedPlanet = hovercell;
				reasonForRedraw = true;
				showDetails(mapData.cells[hovercell].site.planet);
			}
			lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
			lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
			console.log(lastX+','+lastY);
			dragged = true;
			if (dragStart){
				reasonForRedraw = true;
				var pt = offscreen_context.transformedPoint(lastX,lastY);
				offscreen_context.translate(pt.x-dragStart.x,pt.y-dragStart.y);
			}
			if(reasonForRedraw) {
				redraw(mapData); // Only redraw if needed (User is mousing over a planet or dragging the map)
			}
		}
	},false);

	canvas.addEventListener('mouseup',function(evt){
		dragStart = null;
		if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
	},false);

	canvas.addEventListener('DOMMouseScroll',handleScroll,false);
	canvas.addEventListener('mousewheel',handleScroll,false);

	// Set up touch listeners
	var mc = new Hammer.Manager(document.getElementById('canvas-container'));

	// create a pinch recognizer
	var pinch = new Hammer.Pinch();
	
	// add to the Manager
	mc.add([pinch]);

	mc.on('pan', function(evt) {
		if(mapData) {
			var reasonForRedraw = false;
			lastX = evt.pointers[0].clientX;
			lastY = evt.pointers[0].clientY;

			dragged = true;
			if (dragStart){
				reasonForRedraw = true;
				var pt = offscreen_context.transformedPoint(lastX,lastY);
				offscreen_context.translate(pt.x-dragStart.x,pt.y-dragStart.y);
			}

			if(reasonForRedraw) {
				redraw(mapData);
			}
		}
	});

	mc.on('panstart', function(evt) {
		lastX = evt.pointers[0].clientX;
		lastY = evt.pointers[0].clientY;
		dragStart = offscreen_context.transformedPoint(lastX,lastY);
		dragged = false;
	});


	mc.on("pinch", function(evt) {
	    //$('#debug').html(JSON.stringify(Object.keys(evt)) + ' ' + evt.center.x + ',' + evt.center.y + ' final: ' + evt.isFinal);
	    evt.preventDefault();
	    var delta = 0;

	    if(lastScale !== null) {
    		// User is scaling with fingers
    		delta =  evt.scale - lastScale;
	    } else {
    		delta = 0;
	    }

	    lastScale = evt.scale;

	    if(evt.isFinal) {
	    	lastScale = null;
	    }

	    
	    var pt = offscreen_context.transformedPoint(evt.center.x,evt.center.y);
		offscreen_context.translate(pt.x,pt.y);
		var factor = Math.pow(scaleFactor,delta * 15);
		offscreen_context.scale(factor,factor);
		offscreen_context.translate(-pt.x,-pt.y);
		zoomLevel = offscreen_context.getTransform().a;
		if(zoomLevel > 1) {
			planetRadius = initialPlanetRadius;
		} else {
			planetRadius = initialPlanetRadius / zoomLevel;
		}
		redraw(mapData);
	    
	});
}

function zoom (clicks){
	var pt = offscreen_context.transformedPoint(lastX,lastY);
	offscreen_context.translate(pt.x,pt.y);
	var factor = Math.pow(scaleFactor,clicks);
	offscreen_context.scale(factor,factor);
	offscreen_context.translate(-pt.x,-pt.y);
	zoomLevel = offscreen_context.getTransform().a;
	if(zoomLevel > 1) {
		planetRadius = initialPlanetRadius;
	} else {
		planetRadius = initialPlanetRadius / zoomLevel;
	}
	redraw(mapData);
}

function handleScroll (evt){
	var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
	/*if(delta > 1) delta = 1;
	if(delta < -1) delta = -1;*/
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
	console.log('redrawing');
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
			//console.log(cells[cellid].site.planet);
			if(cells[cellid].site.planet.selected) {
				context.fillStyle=factionColor['selected'];
			} else if(cells[cellid].site.planet.contested!=='0') {
				context.fillStyle=factionColor['contested'];
			} else {
				context.fillStyle=factionColor[cells[cellid].site.planet.owner.id];
			}
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
			context.fillStyle = factionPlanetColor[this.site.planet.owner.id];
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

	if(zoomLevel > 4){
		context.font = (fontSize).toFixed(0) + 'px sans-serif';
		context.fillStyle = 'white';
		context.strokeStyle = 'black';
		context.lineWidth = 0.2;
		context.globalAlpha = (zoomLevel - 4) * 0.5;
		$.each(mapData.cells, function(){
			// Then, let's draw all planet names inside the viewport if we are zoomed in enough
			if(this.site.planet.position &&
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