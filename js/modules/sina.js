/**
 * @author GAO JIE @ ESRI2013
 */
define([
        "dojo/_base/declare",
        "dojo/_base/connect",
        "dojo/_base/array",
        "dojo/_base/lang",
        "dojo/_base/event",
        "dojo/io-query",
        "dojo/date/locale",
        "esri",
        "esri/geometry",
        "esri/utils"
],
function(declare ,connect, arr, lang, event, ioQuery, locale, esri){
	var Widget = declare("modules.sina",null,{
		constructor: function(options){
			var _self = this;
			this.options={
					enable: true,
					autopage : true,
					id : 'sina',
					filterUsers : [],
					filterWords : [],
					maxpage : 20,
					limit : 400,
					title : '',
					searchTerm : '',
					symbolUrl : '',
	                dateFrom: '',
	                dateTo: '',
					symbolHeight : 22.5,
					symbolWidth : 18.75,
					popupHeight : 200,
					popupWidth : 290,
					result_type : 'recent'	
			};
			declare.safeMixin(this.options,options);
			if(this.options.map === null){
				throw 'Reference to esri.Map object required';
			}
			this.baseUrl= "https://api.weibo.com/2/place/nearby_timeline.json";

			this.featureCollection={
					layerDefinition:{
						"geometryType" : "esriGeometryPoint",
						"drawingInfo" : {
							"renderer" : {
								"type" : "simple",
								"symbol" : {
									"type" : "esriPMS",
									"url" : this.options.symbolUrl,
									"contentType" : "image/" + this.options.symbolUrl.substring(this.options.symbolUrl.lastIndexOf(".")+1),
									"width" : this.options.symbolWidth,
									"height" : this.options.symbolHeight
								}
							}
						},
						"fields" : [{
							"name" : "OBJECTID",
							"type" : "esriFieldTypeOID"
						},{
							"name" : "smType",
							"type" : "esriFieldTypeString",
							"alias" : "smType",
							"length" : 100
						},{
	                        "name": "created_at",
	                        "type": "esriFieldTypeDate",
	                        "alias": "Created"
						},{
	                        "name": "id",
	                        "type": "esriFieldTypeString",
	                        "alias": "id",
	                        "length": 100
						},{
	                        "name": "from_user",
	                        "type": "esriFieldTypeString",
	                        "alias": "User",
	                        "length": 100
						},{
	                        "name": "location",
	                        "type": "esriFieldTypeString",
	                        "alias": "Location",
	                        "length": 1073741822
						},{
	                        "name": "place",
	                        "type": "esriFieldTypeString",
	                        "alias": "Place",
	                        "length": 100
						},{
	                        "name": "text",
	                        "type": "esriFieldTypeString",
	                        "alias": "Text",
	                        "length": 1073741822
						},{
	                        "name": "profile_image_url",
	                        "type": "esriFieldTypeString",
	                        "alias": "ProfileImage",
	                        "length": 255
						}],
	                    "globalIdField": "id",
	                    "displayField": "from_user"
					},
						featureset : {
							"features" : [],
							"geometryType" : "esriGeometryPoint"
						}
					};
			this.infoTemplate = new esri.InfoTemplate();
			this.infoTemplate.setTitle(function(graphic){
				return _self.config.title;
			});
			this.infoTemplate.setContent(function(graphic){
				return _self.getWindowContent(graphic,_self);
			});
			this.featureLayer = new esri.layers.FeatureLayer(this.featureCollection,{
				id : this.options.id,
				outFields : ["*"],
				infoTemplate : this.infoTemplate,
				visiable : true
			});
			this.options.map.addLayer(this.featureLayer);
			connect.connect(this.featureLayer,"onClick",lang.hitch(this,function(evt){
				event.stop(evt);
				var query = new esri.tasks.Query();
				query.geometry = this.pointToExtent(this.options.map,evt.mapPoint,this.options.symbolWidth);
				var deferred = this.featureLayer.selectFeatures(query,esri.layers.FeatureLayer.SELECTION_NEW);
				this.options.map.infoWindow.setFeatures([deferred]);
				this.options.map.infoWindow.show(evt.mapPoint);
				this.options.map.infoWindow.resize(this.options.popupWidth, this.options.popupHeight);
			}));
            this.stats = {
                    geoPoints: 0,
                    geoNames: 0,
                    noGeo: 0
                };
            this.dataPoints = [];
            this.deferreds = [];
            this.geocoded_ids = {};
            this.loaded = true;
			},
			update: function(options){
				if(!this.options.enable){
					this.onUpdateEnd();
					return;
				}
	            declare.safeMixin(this.options, options);
	            this.constructQuery(this.options.searchTerm);
			},
			pointToExtent: function(map, point, toleranceInPixel){
	            var pixelWidth = map.extent.getWidth() / map.width;
	            var toleraceInMapCoords = toleranceInPixel * pixelWidth;
	            return new esri.geometry.Extent(point.x - toleraceInMapCoords, point.y - toleraceInMapCoords, point.x + toleraceInMapCoords, point.y + toleraceInMapCoords, map.spatialReference);
			},
			getStats: function(){
				var x = this.stats;
				x.total = this.stats.geoPoints + this.stats.noGeo + this.stats.geoNames;
				return x;
			},
			parseURL: function(text){
	            return text.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function (url) {
	                return '<a target="_blank" href="' + url + '">' + url + '</a>';
	            });
			},
	        parseUsername: function (text) {
	            return text.replace(/[@]+[A-Za-z0-9-_]+/g, function (u) {
	                var username = u.replace("@", "");
	                return '<a target="_blank" href="' + location.protocol + '//api.weibo.com/2/users/show.json?screen_name=' + username + '">' + u + '</a>';
	            });
	        },
	        parseHashtag: function (text) {
	            return text.replace(/[#]+[A-Za-z0-9-_]+/g, function (t) {
	                var tag = t.replace("#", "%23");
	                return '<a target="_blank" href="' + location.protocol + '//api.weibo.com/2/search/topics.json?q=' + tag + '">' + t + '</a>';
	            });
	        },
	        getPoints: function () {
	            return this.dataPoints;
	        },
	        clear: function(){
	        	this.query = null;
	        	arr.forEach(this.deferreds,function(def){
	        		def.cancel();
	        	});
	        	if(this.deferreds){
	        		this.deferreds.length = 0;
	        	}
	        	if(this.options.map.infoWindow.isShowing){
	        		this.options.map.infoWindow.hide();
	        	}
	        	if(this.featureLayer.graphics.length > 0){
	        		this.featureLayer.applyEdits(null,null,this.featureLayer.graphics);
	        	}
	        	this.stats =
	        		{
	                    geoPoints: 0,
	                    noGeo: 0,
	                    geoNames: 0
	        		};
	            this.dataPoints = [];
	            this.geocoded_ids = {};
	            this.onClear();
	        },
	        show: function(){
	        	this.featureLayer.setVisibility(true);
	        },
	        hide: function(){
	        	this.featureLayer.setVisibility(false);
	        },
	        setVisibility: function(val){
	        	if(val){
	        		this.show();
	        	}
	        	else{
	        		this.hide();
	        	}
	        },
	        getExtent: function () {
	            return esri.graphicsExtent(this.featureLayer.graphics);
	        },
	        formatDate: function (dateObj) {
	            if (dateObj) {
	                return locale.format(dateObj, {
	                    datePattern: "h:mma",
	                    selector: "date"
	                }).toLowerCase() + ' &middot; ' + locale.format(dateObj, {
	                    datePattern: "yy年MM月dd日",
	                    fullYear: "true",
	                    selector: "date"
	                });
	            }
	        },
	        getRadius: function () {
	            var map = this.options.map;
	            var extent = map.extent;
	            this.maxRadius = 11132;
	            var point1 = new esri.geometry.Point(extent.xmin, extent.ymin, map.spatialReference);
	            var point2 = new esri.geometry.Point(extent.xmax, extent.ymax, map.spatialReference);
	            var length = esri.geometry.getLength(point1,point2);
//	            var radius = Math.min(this.maxRadius, Math.ceil(length * 3.281 / 5280 / 2));
	            var radius = Math.min(this.maxRadius,length);
	            radius = Math.round(radius, 0);
	            var geoPoint = esri.geometry.webMercatorToGeographic(extent.getCenter());
	            return {
	                radius: radius,
	                center: geoPoint,
	                units: "mi"
	            };
	        },
	        getCenterPoint: function(){
	            var map = this.options.map;
	            var extent = map.extent;
	            
	            return esri.geometry.webMercatorToGeographic(extent.getCenter());
	        },
	        getWindowContent: function (graphic, _self) {
	            var date = new Date(graphic.attributes.created_at);
	            var linkedText = _self.parseURL(graphic.attributes.text);
	            linkedText = _self.parseUsername(linkedText);
	            linkedText = _self.parseHashtag(linkedText);
	            // define content for the pop-up window.
	            var html = '';
	            html += '<div class="twContent">';
	            if (graphic.attributes.user.profile_image_url) {
	                var imageURL = graphic.attributes.user.profile_image_url;
	                html += '<a tabindex="0" class="twImage" href="' + location.protocol + '//weibo.com/u/' + graphic.attributes.user.idstr + '" target="_blank"><img class="shadow" src="' + imageURL + '" width="40" height="40"></a>';
	            }
//	            html += '<div class="followButton"><iframe allowtransparency="true" frameborder="0" scrolling="no" src="//platform.twitter.com/widgets/follow_button.html?screen_name=' + graphic.attributes.from_user + '&lang=' + locale + '&show_count=false&show_screen_name=false" style="width:60px; height:20px;"></iframe></div>';
	            html += '<h3 class="twUsername">' + graphic.attributes.user.screen_name + '</h3>';
	            html += '<div class="twUser"><a target="_blank" href="' + location.protocol + '//weibo.com/u/' + graphic.attributes.user.idstr + '">&#64;' + graphic.attributes.user.name + '</a></div>';
	            html += '<div class="clear"></div>';
	            html += '<div class="tweet">' + linkedText + '</div>';
	            if(graphic.attributes.thumbnail_pic){
	            	var contentImageUrl = graphic.attributes.thumbnail_pic;
	            	html += '<a tabindex="0" class="twContentImage" href="' + graphic.attributes.original_pic + '" target="_blank"><img class="shadow" src="' + contentImageUrl + '" width="60" height="80"></a>';
	            }
	            if (graphic.attributes.created_at) {
	                html += '<div class="twDate"><a target="_blank" href="' + location.protocol + '//weibo.com/u/' + graphic.attributes.user.idstr + '">' + this.formatDate(date) + '</a></div>';
	            }
	            var tmp = dojo.locale.split('-');
	            var locale = 'en';
	            if (tmp[0]) {
	                locale = tmp[0];
	            }
	            html += '<div class="actions">';
	            
//	            html += '<a title="" class="reply" href="https://twitter.com/intent/tweet?in_reply_to=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
//	            html += '<a title="" class="retweet" href="https://twitter.com/intent/retweet?tweet_id=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
//	            html += '<a title="" class="favorite" href="https://twitter.com/intent/favorite?tweet_id=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
	            html += '</div>';
	            html += '</div>';
	            return html;
	        },
	        constructQuery: function (searchValue) {
	            var radius = this.getRadius();
	            var search = lang.trim(searchValue);
	            if (search.length === 0) {
	                search = "";
	            }
	            var locale = false;
	            var localeTmp = dojo.locale.split('-');
	            if (localeTmp[0]) {
	                locale = localeTmp[0];
	            }
                this.query = {
                		lat: radius.center.y,
                		long: radius.center.x,
                		range: radius.radius,
                		access_token: '',               //请在此处填写新浪微博的access_token
                		page: 1,
                		count: 50
                };
                if (this.options.dateTo && this.options.dateFrom) {
                    this.query.endtime = Math.round(this.options.dateTo / 1000);
                    this.query.starttime = Math.round(this.options.dateFrom / 1000);
                }
	            this.readedNum = 0;
	            this.sendRequest(this.baseUrl + "?" + ioQuery.objectToQuery(this.query));
	        },
	        sendRequest: function (url) {
	            // get the results from sina for each page
	            var deferred = esri.request({
	                url: url,
	                handleAs: "json",
	                timeout: 10000,
	                callbackParamName: "callback",
	                preventCache: true,
	                load: lang.hitch(this, function (data) {
	                	if(data.data.error_code== 10023&& this.options.enable){
	                		alert('新浪微博访问次数超限！请稍后访问!');
	                		this.options.enable= false;
	                		this.onUpdateEnd();
	                		return;
	                	}
	                    if (this.options.enable&&data.data.length > 0) {
	                    	var obj = data.data.substring(data.data.indexOf("(")+1,data.data.lastIndexOf(")"));
	                    	eval("var jsonobj = "+obj);
	                        this.mapResults(jsonobj);
	                        this.readedNum+= jsonobj.statuses.length;
	                        // display results for multiple pages
	                        if ((this.options.autopage)  && (this.options.maxpage > this.query.page) && (this.readedNum < jsonobj.total_number) && (this.query)) {
	                            
	                            this.query.page++;

	                            this.sendRequest(this.baseUrl + "?" + ioQuery.objectToQuery(this.query));
	                        } else {
	                            this.onUpdateEnd();
	                        }
	                    } else {
	                        // No results found, try another search term
	                        this.onUpdateEnd();
	                    }
	                }),
	                error: lang.hitch(this, function (e) {
	                    if (deferred.canceled) {
	                        console.log('Search Cancelled');
	                    } else {
	                        console.log('Search error' + ": " + e.message);
	                    }
	                    this.onError(e);
	                })
	            });
	            this.deferreds.push(deferred);
	        },
	        unbindDef: function (dfd) {
	            // if deferred has already finished, remove from deferreds array
	            var index = arr.indexOf(this.deferreds, dfd);
	            if (index === -1) {
	                return; // did not find
	            }
	            this.deferreds.splice(index, 1);
	            if (!this.deferreds.length) {
	                return 2; // indicates we received results from all expected deferreds
	            }
	            return 1; // found and removed
	        },
	        findWordInText: function (word, text) {
	            if (word && text) {
	                // text
	                var searchString = text.toLowerCase();
	                // word
	                var badWord = ' ' + word.toLowerCase() + ' ';
	                // IF FOUND
	                if (searchString.indexOf(badWord) > -1) {
	                    return true;
	                }
	            }
	            return false;
	        },
	        findPosition: function(result){      //根据【我在】短链接获取地址
	        	var _self = this;
	        	var positionUrl = '';
	        	if(result.text.indexOf("我在:")>-1){
	        		positionUrl= result.text.substring(result.text.indexOf('我在:')+3,result.text.length);
	        	}
	        	else if(result.text.indexOf("我在这里:")>-1){
	        		positionUrl= result.text.substring(result.text.indexOf('我在这里:')+5,result.text.length);
	        	}
	        	if(positionUrl!= ''){
	        		_self.positionUrlExpand(positionUrl, result);
	        	} 	
	        },
	        positionUrlExpand: function(positionUrl, result){    //解析短链接获取地址
	        	if(positionUrl== '') return;
	        	var _self = this;
	        	var positionQuery= {
	        			url_short: positionUrl,
	        			access_token: ''                 //请在此处填写新浪微博的access_token
	        	};
	        	var requestUrl= "https://api.weibo.com/2/short_url/expand.json?" + ioQuery.objectToQuery(positionQuery);
	        	
	        	esri.request({
	        		url: requestUrl,
	        		handleAs: "json",
	        		timeout: 10000,
	        		callbackParamName: "callback",
	        		preventCache: true,
	        		load: lang.hitch(this, function (data) {
	        			var longUrl= data.data.urls[0].url_long.substring(data.data.urls[0].url_long.indexOf('100101')+6,data.data.urls[0].url_long.length);
	        			if(longUrl.indexOf('_')> -1){
	        				result.geo= {
	        						type: 'Point',
	        						coordinates: [
	        						              parseFloat(longUrl.substring(longUrl.indexOf('_')+1,longUrl.length)),
	        						              parseFloat(longUrl.substring(0,longUrl.indexOf('_')))
	        						              ]
	        				};
	        				var graphic= _self.creatGraphic(result);
	        				if(graphic!= null){
	        		            this.featureLayer.applyEdits([graphic], null, null);
	        		            this.onUpdate();
	        				}
	        			}
	        			else{
	        				this.positionQuery= {
	        						poiid: longUrl,
	        	        			access_token: ''                //请在此处填写新浪微博的access_token
	        				};
	        				this.requestUrl= "https://api.weibo.com/2/place/pois/show.json?" + ioQuery.objectToQuery(this.positionQuery);
	        				esri.request({
	        	        		url: this.requestUrl,
	        	        		handleAs: "json",
	        	        		timeout: 10000,
	        	        		callbackParamName: "callback",
	        	        		preventCache: true,
	        	        		load: lang.hitch(this, function (data){
	        	        			result.geo= {
	    	        						type: 'Point',
	    	        						coordinates: [
	    	        						              parseFloat(data.data.lat),
	    	        						              parseFloat(data.data.lon)
	    	        						              ]
	    	        				};
	    	        				var graphic= _self.creatGraphic(result);
	    	        				if(graphic!= null){
	    	        		            this.featureLayer.applyEdits([graphic], null, null);
	    	        		            this.onUpdate();
	    	        				}
	        	        		}),
	        	        		error: lang.hitch(this, function (e) {
	        	        			this.onError(e);
	        	        		})
	        				});
	        			}
	        		}),
	        		error: lang.hitch(this, function (e) {
	        			this.onError(e);
	        		})
	        	});
	        },
	        isExist:function(result){                            //过滤重复的内容
	        	for(var i=0;i<this.dataPoints.length;i++){
	        		if(result.id==this.dataPoints[i].attributes.id){
	        			return true;
	        		}
	        	}
	        	return false;
	        },
	        contentFilter:function(content){
	        	var _self = this;
	        	if(_self.options.searchTerm===""){
	        		return true;
	        	}
	        	var terms = _self.options.searchTerm.split("|");
	        	for(var i=0; i<terms.length; i++){
	        		if(content.indexOf(terms[i])> -1){
	        			return true;
	        		}
	        	}
	        	return false;
	        },
	        mapResults: function (j) {
	            var _self = this;
	            if (j.error) {
	                console.log('Search error' + ": " + j.error);
	                this.onError(j.error);
	                return;
	            }
	            var b = [];
	            var k = j.statuses;
	            arr.forEach(k, lang.hitch(this, function (result) {
	            	if(!this.isExist(result) && this.contentFilter(result.text) && result.user !== undefined){
		                result.smType = this.options.id;
		                result.filterType = 2;
		                result.filterContent = result.user.url;
		                result.filterAuthor = result.user.id;
		                
		                if(result.geo){
			                var graphic= _self.creatGraphic(result);
			                if(graphic!=null){
			                	b.push(graphic);
			                }
		                }
	            	}
	            }));
	            this.featureLayer.applyEdits(b, null, null);
	            this.onUpdate();
	        },
	        creatGraphic: function(result){            //创建元素
                var geoPoint = null;
                if (result.geo) {
                    var g = result.geo.coordinates;
                    geoPoint = new esri.geometry.Point(parseFloat(g[1]), parseFloat(g[0]));
                } 

                if (geoPoint) {
                    // last check to make sure we parsed it right
                    if (isNaN(geoPoint.x) || isNaN(geoPoint.y) || (parseInt(geoPoint.x, 10) === 0 && parseInt(geoPoint.y, 10) === 0)) {
                        //discard bad geopoints
                        this.stats.noGeo++;
                    } else {
                        // convert the Point to WebMercator projection
                        var a = new esri.geometry.geographicToWebMercator(geoPoint);
                        // make the Point into a Graphic
                        var graphic = new esri.Graphic(a);
                        graphic.setAttributes(result);
                        this.dataPoints.push({
                            geometry: {
                                x: a.x,
                                y: a.y
                            },
                            symbol: esri.symbol.PictureMarkerSymbol(this.featureCollection.layerDefinition.drawingInfo.renderer.symbol),
                            attributes: result
                        });
                        this.stats.geoPoints++;
                        return graphic;
                    }
                } else {
                    this.stats.noGeo++;
                }
                return null;
	        },
	        onUpdate: function () {},
	        onUpdateEnd: function () {
	            this.query = null;
	        },
	        onClear: function () {},
	        onError: function (info) {
	            this.onUpdateEnd();
	        }
		});
	return Widget;
	});