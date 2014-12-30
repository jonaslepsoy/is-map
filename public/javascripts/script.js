var mapData, canvas, ctx;
var dragStart,dragged;
var mousePos = {x:0,y:0};
var zoomLevel = 0.5;
var initialPlanetRadius = 2
var planetRadius = initialPlanetRadius / zoomLevel;
var selectedPlanet = {};

$(document).ready(function(){
	
	canvas = document.getElementById('map');
	ctx = canvas.getContext('2d');

	$(window).resize( responsiveCanvas );

	trackTransforms(ctx);

    responsiveCanvas();

	getMapData('https://static.mwomercs.com/data/cw/mapdata.json');

    //Initial viewport
	ctx.translate(canvas.width / 2,canvas.height / 2);
	ctx.scale(zoomLevel,zoomLevel);

    var lastX=canvas.width/2, lastY=canvas.height/2;

    canvas.addEventListener('mousedown',function(evt){
        document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX,lastY);
        dragged = false;
    },false);

    canvas.addEventListener('mousemove',function(evt){
        getMousePos(canvas,evt);
        redraw();
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart){
            var pt = ctx.transformedPoint(lastX,lastY);
            ctx.translate(pt.x-dragStart.x,pt.y-dragStart.y);
            redraw();
        }
    },false);

    canvas.addEventListener('mouseup',function(evt){
        dragStart = null;
        if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
    },false);

    var scaleFactor = 1.1;

    var zoom = function(clicks){
        var pt = ctx.transformedPoint(lastX,lastY);
        ctx.translate(pt.x,pt.y);
        var factor = Math.pow(scaleFactor,clicks);
        zoomLevel = ctx.getTransform().a;
        if(zoomLevel > 1) {
			planetRadius = initialPlanetRadius;
		} else {
			planetRadius = initialPlanetRadius / zoomLevel;
		}
        ctx.scale(factor,factor);
        ctx.translate(-pt.x,-pt.y);
        redraw();
    }

    var handleScroll = function(evt){
        var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
        if (delta) zoom(delta);
        return evt.preventDefault() && false;
    };

    function getMousePos(canvas, evt) {
		var rect = canvas.getBoundingClientRect();
		mousePos = ctx.transformedPoint(evt.clientX - rect.left, evt.clientY - rect.top);
		trackHoverPlanet(mousePos);
	}

    canvas.addEventListener('DOMMouseScroll',handleScroll,false);
    canvas.addEventListener('mousewheel',handleScroll,false);
})

function redraw(){
    // Clear the entire canvas
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();

    if(mapData) {
    	drawMap();
    }    

    /*ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    writeMousePosition();
    ctx.restore();*/
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
	$.get( url, function( data ) {
		mapData = data;
		$('#date').text('Generated: ' + data.generated);
		redraw();
	});
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
    redraw();
}

function drawMap() {
	$.each(mapData, function(){
		if(this.position && this.position.x && this.position.y) {
			ctx.beginPath();
			ctx.arc(this.position.x, -this.position.y, planetRadius, 0, 2 * Math.PI, false);
			ctx.fillStyle = getFactionColor(this);
			ctx.fill();
			ctx.closePath();
			if(this.selected) {
				ctx.beginPath();
				ctx.arc(this.position.x, -this.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				ctx.strokeStyle = 'cyan';
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.closePath();
			}
			else if(this.contested != 0) {
				ctx.beginPath();
				ctx.arc(this.position.x, -this.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				ctx.strokeStyle = 'red';
				ctx.lineWidth = 4;
	      		ctx.stroke();
	      		ctx.closePath();
      		}
		}
	});
}

function getFactionColor(faction) {
	var factionID = faction.owner.id;
	//console.log(faction);
	if(faction.contested != 0) {
		return '#ff0000';
	}
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
    var shape;
    $.each(mapData, function(){
        if(this.position && this.position.x && this.position.y) {
	        shape = this;
	        if (pointInCircle(mousePos, shape)) {
	            shape.selected = true;
	            //console.log('Mousing over ' + this.name);
	            if(selectedPlanet.name) {
	            	if(selectedPlanet.name !== this.name){
						selectedPlanet = this;
						showDetails(selectedPlanet);
					}
				} else {
					selectedPlanet = this;
					showDetails(selectedPlanet);
				}
	            return;
	        } else {
	        	shape.selected = false;
	        }
	    }
    });
}

function pointInCircle(point, shape) {
    var distX = Math.abs(point.x - shape.position.x),
        distY = Math.abs(point.y - -shape.position.y),
        dist = Math.sqrt(distX * distX + distY * distY);
    return dist < planetRadius;
}

function showDetails (planet){
	$('#planetname').text(planet.name);
	var owner = planet.owner.name;
	if(planet.unit.name !== '') {
		owner += ': ' + planet.unit.name;
	}
	$('#planetowner').text(owner);
	$('#planetownerimage').attr('src',planet.owner.icon);
	$('#planetinvader').text(planet.invading.name);
	$('#planetinvaderimage').attr('src',planet.invading.icon);
	$('#planetdefenselevel').text(planet.defense_level);
}
