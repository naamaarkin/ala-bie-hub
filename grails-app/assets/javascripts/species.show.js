/*
 * Copyright (C) 2022 Atlas of Living Australia
 * All Rights Reserved.
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 */

function showSpeciesPage(traitsTabSet) {
    //console.log("Starting show species page");

    //load content
    loadOverviewImages();
    loadMap();
    loadGalleries();
    loadExpertDistroMap();
    loadExternalSources();
    loadSpeciesLists();
    loadDataProviders();
    loadIndigenousData();
    //
    ////setup controls
    addAlerts();
    loadBhl();
    loadTrove(SHOW_CONF.troveUrl, SHOW_CONF.scientificName, SHOW_CONF.synonyms, 'trove-integration','trove-result-list','previousTrove','nextTrove');
    if (traitsTabSet && SHOW_CONF.kingdom == 'Plantae') {
        loadAusTraits();
    }
}

function loadSpeciesLists(){

    //console.log('### loadSpeciesLists #### ' + SHOW_CONF.speciesListServiceUrl + '/ws/species/' + SHOW_CONF.guid);
    $.getJSON(SHOW_CONF.speciesListServiceUrl + '/ws/species/' + SHOW_CONF.guid + '?isBIE=true', function( data ) {
        for(var i = 0; i < data.length; i++) {
            var specieslist = data[i];
            var maxListFields = 20;

            if (specieslist.list.isBIE) {
                var $description = $('#descriptionTemplate').clone();
                $description.css({'display': 'block'});
                $description.attr('id', '#specieslist-block-' + specieslist.dataResourceUid);
                $description.addClass('species-list-block');
                $description.find(".title").html(specieslist.list.listName);

                if (specieslist.kvpValues.length > 0) {
                    var content = "<table class='table specieslist-table'>";
                    $.each(specieslist.kvpValues, function (idx, kvpValue) {
                        if (idx >= maxListFields) {
                            return false;
                        }
                        var value = kvpValue.value;
                        if(kvpValue.vocabValue){
                            value = kvpValue.vocabValue;
                        }
                        content += "<tr><td>" + (kvpValue.key + "</td><td>" + value + "</td></tr>");
                    });
                    content += "</table>";
                    $description.find(".content").html(content);
                } else {
                    $description.find(".content").html("A species list provided by " + specieslist.list.listName);
                }

                $description.find(".source").css({'display':'none'});
                $description.find(".rights").css({'display':'none'});

                $description.find(".providedBy").attr('href', SHOW_CONF.speciesListUrl + '/speciesListItem/list/' + specieslist.dataResourceUid);
                $description.find(".providedBy").html(specieslist.list.listName);

                $description.appendTo('#listContent');
            }
        }
    });
}

function addAlerts(){
    // alerts button
    $("#alertsButton").click(function(e) {
        e.preventDefault();
        var query = "Species: " + SHOW_CONF.scientificName;
        var searchString = "?q=lsid:" + SHOW_CONF.guid;
        var url = SHOW_CONF.alertsUrl + "/webservice/createBiocacheNewRecordsAlert?";
        url += "queryDisplayName=" + encodeURIComponent(query);
        url += "&baseUrlForWS=" + encodeURIComponent(SHOW_CONF.biocacheServiceUrl);
        url += "&baseUrlForUI=" + encodeURIComponent(SHOW_CONF.biocacheUrl);
        url += "&webserviceQuery=%2Foccurrences%2Fsearch" + encodeURIComponent(searchString);
        url += "&uiQuery=%2Foccurrences%2Fsearch" + encodeURIComponent(searchString);
        url += "&resourceName=" + encodeURIComponent("Atlas");
        window.location.href = url;
    });
}

function loadMap() {

    if(SHOW_CONF.map != null){
        return;
    }

    //add an occurrence layer for this taxon
    var taxonLayer = L.tileLayer.wms(SHOW_CONF.biocacheServiceUrl + "/mapping/wms/reflect?q=lsid:" +
        SHOW_CONF.guid + (SHOW_CONF.qualityProfile? "&qualityProfile="+SHOW_CONF.qualityProfile : "")
        +"&qc=" + SHOW_CONF.mapQueryContext + SHOW_CONF.additionalMapFilter
        , {
        layers: 'ALA:occurrences',
        format: 'image/png',
        transparent: true,
        attribution: SHOW_CONF.mapAttribution,
        bgcolor: "0x000000",
        outline: SHOW_CONF.mapOutline,
        ENV: SHOW_CONF.mapEnvOptions
    });

    var speciesLayers = new L.LayerGroup();
    taxonLayer.addTo(speciesLayers);

    SHOW_CONF.map = L.map('leafletMap', {
        center: [SHOW_CONF.defaultDecimalLatitude, SHOW_CONF.defaultDecimalLongitude],
        zoom: SHOW_CONF.defaultZoomLevel,
        layers: [speciesLayers],
        scrollWheelZoom: false
    });

    var defaultBaseLayer = L.tileLayer(SHOW_CONF.defaultMapUrl, {
        attribution: SHOW_CONF.defaultMapAttr,
        subdomains: SHOW_CONF.defaultMapDomain,
        mapid: SHOW_CONF.defaultMapId,
        token: SHOW_CONF.defaultMapToken
    });

    defaultBaseLayer.addTo(SHOW_CONF.map);

    var baseLayers = {
        "Base layer": defaultBaseLayer
    };

    var sciName = SHOW_CONF.scientificName;

    var overlays = {};
    overlays[sciName] = taxonLayer;

    L.control.layers(baseLayers, overlays).addTo(SHOW_CONF.map);

    //SHOW_CONF.map.on('click', onMapClick);
    SHOW_CONF.map.invalidateSize(false);

    updateOccurrenceCount();
    fitMapToBounds();
}

/**
 * Update the total records count for the occurrence map in heading text
 */
function updateOccurrenceCount() {
    $.getJSON(SHOW_CONF.biocacheServiceUrl + '/occurrences/search?q=lsid:' + SHOW_CONF.guid + "&qualityProfile="+SHOW_CONF.qualityProfile+"&fq=" + SHOW_CONF.mapQueryContext, function( data ) {
        if (data) {
            if(data.totalRecords > 0){
                $('.occurrenceRecordCount').html(data.totalRecords.toLocaleString());
            } else{
                // hide charts if no records
                $("#recordBreakdowns").html("<h3>" + jQuery.i18n.prop("no.records.found") + "</h3>");
            }
        }
    });
}

function fitMapToBounds() {
    var jsonUrl = SHOW_CONF.biocacheServiceUrl + "/mapping/bounds?q=lsid:" + SHOW_CONF.guid;
    $.getJSON(jsonUrl, function(data) {
        if (data.length == 4 && data[0] != 0 && data[1] != 0) {
            //console.log("data", data);
            var sw = L.latLng(data[1],data[0]);
            var ne = L.latLng(data[3],data[2]);
            //console.log("sw", sw.toString());
            var dataBounds = L.latLngBounds(sw, ne);
            //var centre = dataBounds.getCenter();
            var mapBounds = SHOW_CONF.map.getBounds();

            if (!mapBounds.contains(dataBounds) && !mapBounds.intersects(dataBounds)) {
                SHOW_CONF.map.fitBounds(dataBounds);
                if (SHOW_CONF.map.getZoom() > 3) {
                    SHOW_CONF.map.setZoom(3);
                }
            }

            SHOW_CONF.map.invalidateSize(true);
        }
    });
}

//function onMapClick(e) {
//    $.ajax({
//        url: SHOW_CONF.biocacheServiceUrl + "/occurrences/info",
//        jsonp: "callback",
//        dataType: "jsonp",
//        data: {
//            q: SHOW_CONF.scientificName,
//            zoom: "6",
//            lat: e.latlng.lat,
//            lon: e.latlng.lng,
//            radius: 20,
//            format: "json"
//        },
//        success: function (response) {
//            var popup = L.popup()
//                .setLatLng(e.latlng)
//                .setContent("Occurrences at this point: " + response.count)
//                .openOn(SHOW_CONF.map);
//        }
//    });
//}

function loadAusTraits() {
    $.ajax({url: SHOW_CONF.ausTraitsSummaryUrl}).done(function (data) {
        // handle if traits  controller returns an error
        if (data.error){
            $("#traitsRecords").html("<p style='font-size: small'>" + jQuery.i18n.prop("no.traits.connection") +" You can find more infomation on AusTraits   <a target='_blank' href='"+SHOW_CONF.ausTraitsHomeUrl+"'>here</a>. </p>");
            $("#download-button-area").hide()
            $(".panel-footer").hide();
        } else if (data.numeric_traits && data.categorical_traits) {
            $.each(data.categorical_traits, function (idx, traitValue) {
                var tableRow = "<tr><td>";
                tableRow += traitValue.trait_name + "</td><td>"
                tableRow += traitValue.trait_values + "</td><td class='centered-cell'>"
                tableRow += "<a target='_blank' href=" + traitValue.definition + "> <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-box-arrow-up-right\" viewBox=\"0 0 16 16\">\n" +
                    "  <path fill-rule=\"evenodd\" d=\"M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z\"/>\n" +
                    "  <path fill-rule=\"evenodd\" d=\"M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z\"/>\n" +
                    "</svg></a></td></tr>";

                $('#categorical-traits tbody').append(tableRow);
            });

            $.each(data.numeric_traits, function (idx, traitValue) {
                console.log(traitValue.min, traitValue.mean, traitValue.max)
                var tableRow = "<tr><td>";
                tableRow += traitValue.trait_name + "</td><td class='centered-cell'>"
                tableRow += (traitValue.min || " - " ) + "</td><td class='centered-cell'>"
                tableRow += (traitValue.mean || " - " )+ "</td><td class='centered-cell'>"
                tableRow += (traitValue.max  || " - " ) + "</td><td class='centered-cell'>"
                tableRow += traitValue.unit + "</td><td class='centered-cell'>"
                tableRow += "<a target='_blank' href=" + traitValue.definition + "> <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-box-arrow-up-right\" viewBox=\"0 0 16 16\">\n" +
                    "  <path fill-rule=\"evenodd\" d=\"M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z\"/>\n" +
                    "  <path fill-rule=\"evenodd\" d=\"M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z\"/>\n" +
                    "</svg></a></td></tr>"
                $('#numeric-traits tbody').append(tableRow);
            });

        } else {
            $("#traitsRecords").html("<h3>" + jQuery.i18n.prop("no.traits.found") + "</h3>");
            $("#download-button-area").hide()
            $(".panel-footer").hide();
        }
        // apply table cell styling after content is loaded.
        $(".centered-cell").css({"text-align": "center"})

    }).error(function (jqXHR, textStatus, errorThrown) {
        console.warn("error " + textStatus);
        console.warn("incoming Text " + jqXHR.responseText);
    });

    $.ajax({url:SHOW_CONF.ausTraitsCountUrl}).done(function (data) {
        if (data[0] && data[0]["summary"] && data[0]["AusTraits"] && data[0]["taxon"] ){
            let htmlContent =  "<span> There are " + data[0]["summary"]+ " available for <span class='scientific-name rank-"+SHOW_CONF.rankString+"'><span class='name'>"+ data[0]["taxon"] +"</span></span>  with data for "+ data[0]["AusTraits"] +
                " further traits in the <a  target='_blank' href='"+SHOW_CONF.ausTraitsHomeUrl+"'>AusTraits</a> database. These are accessible via the download CSV button or alternatively the entire database can be accessed at  <a target='_blank' href='"+SHOW_CONF.ausTraitsSourceUrl+"'>"+SHOW_CONF.ausTraitsSourceUrl+"</a>. </span>"
            $('#traits-description').html(htmlContent);
        }
    }).error(function (jqXHR, textStatus, errorThrown) {
        console.warn("error " + textStatus);
        console.warn("incoming Text " + jqXHR.responseText);
    });
}

/**
 * Toggle the Austraits summary section and update the toggle action text accordingly
 */
function toggleTraitsSummary(){
    const summary = $('#austraits-summary');
    const summaryToggle = $('#austraits-summary-toggle');
    const expanded = summary.attr('aria-expanded')
    if(expanded === "true"){
        summary.collapse('hide');
        summaryToggle.text("See More")
    } else{
        summary.collapse('show');
        summaryToggle.text("See Less")
    }
}

function loadDataProviders(){

    var url = SHOW_CONF.biocacheServiceUrl  +
        '/occurrences/search?q=lsid:' +
        SHOW_CONF.guid +
        '&pageSize=0&flimit=-1';

    if(SHOW_CONF.mapQueryContext){
       url = url + '&fq=' + SHOW_CONF.mapQueryContext;
    }

    url = url + '&facet=on&facets=data_resource_uid';

    var uiUrl = SHOW_CONF.biocacheUrl  +
        '/occurrences/search?q=lsid:' +
        SHOW_CONF.guid;

    $.getJSON(url, function(data){

        if(data.totalRecords > 0) {

            var datasetCount = data.facetResults[0].fieldResult.length;

            //exclude the "Unknown facet value"
            if(data.facetResults[0].fieldResult[datasetCount - 1].label == "Unknown"){
                datasetCount = datasetCount - 1;
            }

            if(datasetCount == 1){
                $('.datasetLabel').html("dataset has");
            }

            $('.datasetCount').html(datasetCount);
            $.each(data.facetResults[0].fieldResult, function (idx, facetValue) {
                //console.log(data.facetResults[0].fieldResult);
                if(facetValue.count > 0){

                    var uid = facetValue.fq.replace(/data_resource_uid:/, '').replace(/[\\"]*/, '').replace(/[\\"]/, '');
                    var dataResourceUrl =  SHOW_CONF.collectoryUrl + "/public/show/" + uid;
                    var tableRow = "<tr><td><a href='" + dataResourceUrl + "'><span class='data-provider-name'>" + facetValue.label + "</span></a>";

                    //console.log(uid);
                    $.getJSON(SHOW_CONF.collectoryServiceUrl + "/ws/dataResource/" + uid, function(collectoryData) {


                        if(collectoryData.provider){
                            tableRow += "<br/><small><a href='" + SHOW_CONF.collectoryUrl + '/public/show/' + uid + "'>" + collectoryData.provider.name + "</a></small>";
                        }
                        tableRow += "</td>";
                        tableRow += "<td>" + collectoryData.licenseType + "</td>";

                        var queryUrl = uiUrl + "&fq=" + facetValue.fq;
                        tableRow += "</td><td><a href='" + queryUrl + "'><span class='record-count'>" + facetValue.count + "</span></a></td>"
                        tableRow += "</tr>";
                        $('#data-providers-list tbody').append(tableRow);
                    });
                }
            });
        }
    });
}

function loadIndigenousData() {

    if(!SHOW_CONF.profileServiceUrl || SHOW_CONF.profileServiceUrl == ""){
        return;
    }

    var url = SHOW_CONF.profileServiceUrl + "/api/v1/profiles?summary=true&tags=IEK&guids=" + SHOW_CONF.guid;
    $.getJSON(url, function (data) {
        if (data.total > 0) {
            $("#indigenous-info-tab").parent().removeClass("hide");

            $.each(data.profiles, function(index, profile) {
                var panel = $('#indigenous-profile-summary-template').clone();
                panel.removeClass("hide");
                panel.attr("id", profile.id);

                var logo = profile.collection.logo || SHOW_CONF.noImage100Url;
                panel.find(".collection-logo").append("<img src='" + logo + "' alt='" + profile.collection.title + " logo'>");
                panel.find(".collection-logo-caption").append(profile.collection.title);


                panel.find(".profile-name").append(profile.name);
                panel.find(".collection-name").append("(" + profile.collection.title + ")");
                var otherNames = "";
                var summary = "";
                $.each(profile.attributes, function (index, attribute) {
                    if (attribute.name) {
                        otherNames += attribute.text;
                        if (index < profile.attributes.length - 2) {
                            otherNames += ", ";
                        }
                    }
                    if (attribute.summary) {
                        summary = attribute.text;
                    }
                });
                panel.find(".other-names").append(otherNames);
                panel.find(".summary-text").append(summary);
                panel.find(".profile-link").append("<a href='" + profile.url + "' title='Click to view the whole profile' target='_blank'>View the full profile</a>");

                if(profile.thumbnailUrl) {
                    panel.find(".main-image").removeClass("hide");

                    panel.find(".image-embedded").append("<img src='" + profile.thumbnailUrl + "' alt='" + profile.collection.title + " main image'>");
                }

                if(profile.mainVideo) {
                    panel.find(".main-video").removeClass("hide");
                    panel.find(".video-name").append(profile.mainVideo.name);
                    panel.find(".video-attribution").append(profile.mainVideo.attribution);
                    panel.find(".video-license").append(profile.mainVideo.license);
                    panel.find(".video-embedded").append(profile.mainVideo.embeddedVideo);
                }

                if(profile.mainAudio) {
                    panel.find(".main-audio").removeClass("hide");
                    panel.find(".audio-name").append(profile.mainAudio.name);
                    panel.find(".audio-attribution").append(profile.mainAudio.attribution);
                    panel.find(".audio-license").append(profile.mainAudio.license);
                    panel.find(".audio-embedded").append(profile.mainAudio.embeddedAudio);
                }

                panel.appendTo("#indigenous-info");
            });
        }
    });
}

function loadExternalSources(){
    //load EOL content
    //console.log('####### Loading EOL content - ' + SHOW_CONF.eolUrl);
    $.ajax({url: SHOW_CONF.eolUrl}).done(function ( data ) {
        //console.log(data);
        //clone a description template...
        if(data.taxonConcept && data.taxonConcept.dataObjects){
            //console.log('Loading EOL content - ' + data.taxonConcept.dataObjects.length);
            var eolIdentifier = data.taxonConcept.identifier;
            $.each(data.taxonConcept.dataObjects, function(idx, dataObject){
                //console.log('Loading EOL content -> ' + dataObject.description);
                // Data objects are now language filtered on the server
                var $description = $('#descriptionTemplate').clone();
                $description.css({'display':'block'});
                $description.attr('id', dataObject.id);
                $description.find(".title").html(dataObject.title ?  dataObject.title : 'Description');

                var descriptionDom = $.parseHTML( dataObject.description );
                var body = $(descriptionDom).find('#bodyContent > p:lt(2)').html(); // for really long EOL blocks

                if (body) {
                    $description.find(".content").html(body);
                } else {
                    $description.find(".content").html(dataObject.description);
                }


                if(dataObject.source && dataObject.source.trim().length != 0){
                    var sourceText = dataObject.source;
                    var sourceHtml = "";

                    if (sourceText.match("^http")) {
                        sourceHtml = "<a href='" + sourceText + "' target='eol'>"  + sourceText + "</a>"
                    } else {
                        sourceHtml = sourceText;
                    }

                    $description.find(".sourceText").html(sourceHtml);
                } else {
                    $description.find(".source").css({'display':'none'});
                }
                if(dataObject.rightsHolder && dataObject.rightsHolder.trim().length != 0){
                    $description.find(".rightsText").html(dataObject.rightsHolder);
                } else {
                    $description.find(".rights").css({'display':'none'});
                }

                $description.find(".providedBy").attr('href', 'https://eol.org/pages/' + eolIdentifier);
                $description.find(".providedBy").attr('target', '_blank');
                $description.find(".providedBy").html("Encyclopedia of Life");
                $description.appendTo('#descriptiveContent');
            });
        }
    });

    //load Genbank content
    $.ajax({url: SHOW_CONF.genbankUrl}).done(function ( data ) {
        if(data.total){
            $('.genbankResultCount').html('<a href="' + data.resultsUrl + '">View all results - ' + data.total + '</a>');
            if(data.results){
                $.each(data.results, function(idx, result){
                    var $genbank =  $('#genbankTemplate').clone();
                    $genbank.removeClass('hide');
                    $genbank.find('.externalLink').attr('href', result.link);
                    $genbank.find('.externalLink').html(result.title);
                    $genbank.find('.description').html(result.description);
                    $genbank.find('.furtherDescription').html(result.furtherDescription);
                    $('.genbank-results').append($genbank);
                });
            }
        }
    });

    //load sound content
    $.ajax({url: SHOW_CONF.soundUrl}).done(function ( data ) {
        if(data.sounds){
            var soundsDiv = "<div class='panel panel-default '><div class='panel-heading'>";
            soundsDiv += '<h3 class="panel-title">Sounds</h3></div><div class="panel-body">';
            soundsDiv += '<audio src="' + data.sounds[0].alternativeFormats['audio/mpeg'] + '" preload="auto" />';
            audiojs.events.ready(function() {
                var as = audiojs.createAll();
            });
            var source = "";

            if (data.processed.attribution.collectionName) {
                var attrUrl = "";
                var attrUrlPrefix = SHOW_CONF.collectoryUrl + "/public/show/";
                if (data.raw.attribution.dataResourceUid) {
                    attrUrl = attrUrlPrefix + data.raw.attribution.dataResourceUid;
                } else if (data.processed.attribution.collectionUid) {
                    attrUrl = attrUrlPrefix + data.processed.attribution.collectionUid;
                }

                if (data.raw.attribution.dataResourceUid == "dr341") {
                    // hard-coded copyright as most sounds are from ANWC and are missing attribution data fields
                    source += "&copy; " + data.processed.attribution.collectionName + " " + data.processed.event.year + "<br>";
                }

                if (attrUrl) {
                    source += "Source: <a href='" + attrUrl + "' target='biocache'>" + data.processed.attribution.collectionName + "</a>";
                } else {
                    source += data.processed.attribution.collectionName;
                }


            } else {
                source += "Source: " + data.processed.attribution.dataResourceName
            }

            soundsDiv += '</div><div class="panel-footer"><p>' + source + '<br>';
            soundsDiv += '<a href="' + SHOW_CONF.biocacheUrl + '/occurrence/'+ data.raw.rowKey +'">View more details of this audio</a></p>';
            soundsDiv += '</div></div>';
            $('#sounds').append(soundsDiv);
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.warn("AUDIO Error", errorThrown, textStatus);
    });
}

/**
 * Trigger loading of the 3 gallery sections
 */
function loadGalleries() {
    //console.log('loading galleries');
    $('#gallerySpinner').show();
    loadGalleryType('type', 0)
    loadGalleryType('specimen', 0)
    loadGalleryType('other', 0)
    loadGalleryType('uncertain',0)
}

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

/**
 * Load overview images on the species page. This is separate from the main galleries.
 */
function loadOverviewImages(){
    var hasPreferredImage = false; // Could get a race condition where no main image gets loaded due callbacks

    if (SHOW_CONF.preferredImageId) {
        hasPreferredImage = true;
        var prefUrl = SHOW_CONF.biocacheServiceUrl  +
            '/occurrences/search?q=images:' + SHOW_CONF.preferredImageId +
            '&fq=-assertion_user_id:*&im=true&facet=off&pageSize=1&start=0';
        $.getJSON(prefUrl, function(data){
            // console.log("prefUrl", prefUrl, data);
            if (data && data.totalRecords > 0) {
                addOverviewImage(data.occurrences[0]);
            } else {
                var record = {
                    'uuid': null,
                    'image': SHOW_CONF.preferredImageId,
                    'scientificName': SHOW_CONF.scientificName,
                    'largeImageUrl':  SHOW_CONF.imageServiceBaseUrl + "image/"+SHOW_CONF.preferredImageId+"/large"
                }
                addOverviewImage(record)
            }

        }).fail(function(jqxhr, textStatus, error) {
            alert('Error loading overview image: ' + textStatus + ', ' + error);
            hasPreferredImage = false;
        });
    }

    var url = SHOW_CONF.biocacheServiceUrl  +
        '/occurrences/search?q=lsid:' +
        SHOW_CONF.guid +
        '&fq=multimedia:"Image"&fq=geospatial_kosher:true&fq=-user_assertions:50001&fq=-user_assertions:50005&im=true&facet=off&pageSize=5&start=0';
    //console.log('Loading images from: ' + url);

    $.getJSON(url, function(data){
        if (data && data.totalRecords > 0) {
            addOverviewImages(data.occurrences, hasPreferredImage);
        }
    }).fail(function(jqxhr, textStatus, error) {
        alert('Error loading overview images: ' + textStatus + ', ' + error);
    }).always(function() {
        $('#gallerySpinner').hide();
    });
}

function addOverviewImages(imagesArray, hasPreferredImage) {

    if (!hasPreferredImage) {
        // no preferred image so use first in results set
        addOverviewImage(imagesArray[0]);
    }

    for (j = 1; j < 5; j++) {
        // load smaller thumb images
        if(imagesArray.length > j) {
            addOverviewThumb(imagesArray[j], j)
        }
    }
}

function addOverviewImage(overviewImageRecord) {
    $('#noOverviewImages').addClass('hide');
    $('.main-img').removeClass('hide');
    $('.thumb-row').removeClass('hide');
    var $categoryTmpl = $('#overviewImages');
    $categoryTmpl.removeClass('hide');

    var $mainOverviewImage = $('.mainOverviewImage');
    $mainOverviewImage.attr('src',overviewImageRecord.largeImageUrl);
    $mainOverviewImage.parent().attr('href', overviewImageRecord.largeImageUrl);
    $mainOverviewImage.parent().attr('data-title', getImageTitleFromOccurrence(overviewImageRecord));
    $mainOverviewImage.parent().attr('data-footer', getImageFooterFromOccurrence(overviewImageRecord));
    $mainOverviewImage.parent().attr('data-image-id', overviewImageRecord.image);
    $mainOverviewImage.parent().attr('data-record-url', SHOW_CONF.biocacheUrl + '/occurrences/' + overviewImageRecord.uuid);

    $('.mainOverviewImageInfo').html(getImageTitleFromOccurrence(overviewImageRecord));
}

function addOverviewThumb(record, i) {

    if (i < 4) {
        var $thumb = generateOverviewThumb(record, i);
        $('#overview-thumbs').append($thumb);
    } else {
        $('#more-photo-thumb-link').attr('style', 'background-image:url(' + record.smallImageUrl + ')');
    }
}

function generateOverviewThumb(occurrence, id){
    var $taxonSummaryThumb = $('#taxon-summary-thumb-template').clone();
    var $taxonSummaryThumbLink = $taxonSummaryThumb.find('a');
    $taxonSummaryThumb.removeClass('hide');
    $taxonSummaryThumb.attr('id', 'taxon-summary-thumb-'+id);
    $taxonSummaryThumb.attr('style', 'background-image:url(' + occurrence.smallImageUrl + ')');
    $taxonSummaryThumbLink.attr('data-title', getImageTitleFromOccurrence(occurrence));
    $taxonSummaryThumbLink.attr('data-footer', getImageFooterFromOccurrence(occurrence));
    $taxonSummaryThumbLink.attr('href', occurrence.largeImageUrl);
    $taxonSummaryThumbLink.attr('data-image-id', occurrence.image);
    $taxonSummaryThumbLink.attr('data-record-url', SHOW_CONF.biocacheUrl + '/occurrences/' + occurrence.uuid);
    return $taxonSummaryThumb;
}

/**
 * AJAX loading of gallery images from biocache-service
 *
 * @param category
 * @param start
 */
function loadGalleryType(category, start) {

    //console.log("Loading images category: " + category);

    var imageCategoryParams = {
        type: '&fq=type_status:*',
        specimen: '&fq=basis_of_record:PreservedSpecimen&fq=-type_status:*',
        other: '&fq=-type_status:*&fq=-basis_of_record:PreservedSpecimen&fq=-identification_qualifier_s:"Uncertain"&fq=geospatial_kosher:true&fq=-user_assertions:50001&fq=-user_assertions:50005&sort=identification_qualifier_s&dir=asc',
        uncertain: '&fq=-type_status:*&fq=-basis_of_record:PreservedSpecimen&fq=identification_qualifier_s:"Uncertain"'
    };

    var pageSize = 20;

    if (start > 0) {
        $('.loadMore.' + category + ' button').addClass('disabled');
        $('.loadMore.' + category + ' img').removeClass('hide');
    }

    //TODO a toggle between LSID based searches and names searches
    var url = SHOW_CONF.biocacheServiceUrl  +
        '/occurrences/search?q=lsid:' +
        SHOW_CONF.guid +
        (SHOW_CONF.qualityProfile ? "&qualityProfile=" + SHOW_CONF.qualityProfile : "") + '&fq=multimedia:"Image"&pageSize=' + pageSize +
        '&facet=off&start=' + start + imageCategoryParams[category] + '&im=true';

    //console.log("URL: " + url);

    $.getJSON(url, function(data){

        //console.log('Total images: ' + data.totalRecords + ", category: " + category);

        if (data && data.totalRecords > 0) {
            var br = "<br>";
            var $categoryTmpl = $('#cat_' + category);
            $categoryTmpl.removeClass('hide');

            $.each(data.occurrences, function(i, el) {
                // clone template div & populate with metadata
                var $taxonThumb = $('#taxon-thumb-template').clone();
                $taxonThumb.removeClass('hide');
                $taxonThumb.attr('id','thumb_' + category + i);
                $taxonThumb.attr('href', el.largeImageUrl);
                $taxonThumb.find('img').attr('src', el.smallImageUrl);
                // turned off 'onerror' below as IE11 hides all images
                //$taxonThumb.find('img').attr('onerror',"$(this).parent().hide();"); // hide broken images

                // brief metadata
                var briefHtml = getImageTitleFromOccurrence(el);
                $taxonThumb.find('.caption-brief').html(briefHtml);
                $taxonThumb.attr('data-title', briefHtml);
                $taxonThumb.find('.caption-detail').html(briefHtml);

                // write to DOM
                $taxonThumb.attr('data-footer', getImageFooterFromOccurrence(el));
                $taxonThumb.attr('data-image-id', el.image);
                $taxonThumb.attr('data-record-url', SHOW_CONF.biocacheUrl + '/occurrences/' + el.uuid);
                $categoryTmpl.find('.taxon-gallery').append($taxonThumb);
            });

            $('.loadMore.' + category).remove(); // remove 'load more images' button that was just clicked

            if (data.totalRecords > (start + pageSize)) {
                // add new 'load more images' button if required
                var spinnerLink = $('img#gallerySpinner').attr('src');
                var btn = '<div class="loadMore ' + category + '"><br><button class="btn btn-default" onCLick="loadGalleryType(\'' + category + '\','
                    + (start + pageSize)  + ');">Load more images <img src="' + spinnerLink + '" class="hide"/></button></div>';
                $categoryTmpl.find('.taxon-gallery').append(btn);
            }
        } else {
            $('#cat_nonavailable').addClass('show');
        }
    }).fail(function(jqxhr, textStatus, error) {
        alert('Error loading gallery: ' + textStatus + ', ' + error);
    }).always(function() {
        $('#gallerySpinner').hide();
    });
}

function getImageTitleFromOccurrence(el){
    var br = "<br/>";
    var briefHtml = "";
    //include sci name when genus or higher taxon
    if(SHOW_CONF.taxonRankID  < 7000) {
        briefHtml += (el.raw_scientificName === undefined? el.scientificName : el.raw_scientificName); //raw scientific name can be null, e.g. if taxon GUIDS were submitted
    }

    if (el.typeStatus) {
        if(briefHtml.length > 0)  briefHtml += br;
        briefHtml += el.typeStatus;
    }

    if (el.institutionName) {
        if(briefHtml.length > 0)  briefHtml += br;
        briefHtml += ((el.typeStatus) ? ' | ' : br) + el.institutionName;
    }

    if(el.imageMetadata && el.imageMetadata.length > 0 && el.imageMetadata[0].creator != null){
        if(briefHtml.length > 0)  briefHtml += br;
        briefHtml += "Photographer: " + el.imageMetadata[0].creator;
    } else if(el.imageMetadata && el.imageMetadata.length > 0 && el.imageMetadata[0].rightsHolder != null) {
        if(briefHtml.length > 0)  briefHtml += br;
        briefHtml += "Rights holder: " + el.imageMetadata[0].rightsHolder;
    } else if(el.collector){
        if(briefHtml.length > 0)  briefHtml += br;
        briefHtml += "Supplied by: " + el.collector;
    }

    return briefHtml;
}

function getImageFooterFromOccurrence(el){
    var br = "<br/>";
    var detailHtml = (el.raw_scientificName === undefined? el.scientificName : el.raw_scientificName); //raw scientific name can be null, e.g. if taxon GUIDS were submitted
    if (el.typeStatus) detailHtml += br + 'Type: ' + el.typeStatus;
    if (el.collector) detailHtml += br + 'By: ' + el.collector;
    if (el.eventDate) detailHtml += br + 'Date: ' + moment(el.eventDate).format('YYYY-MM-DD');
    if (el.institutionName && el.institutionName !== undefined) {
        detailHtml += br + "Supplied by: " + el.institutionName;
    } else if (el.dataResourceName && el.dataResourceName !== undefined) {
        detailHtml += br + "Supplied by: " + el.dataResourceName;
    }
    if(el.imageMetadata && el.imageMetadata.length > 0 && el.imageMetadata[0].rightsHolder != null){
        detailHtml += br + "Rights holder: " + el.imageMetadata[0].rightsHolder;
    }

    // write to DOM
    if (el.uuid) {
        detailHtml += '<div class="recordLink"><a href="' + SHOW_CONF.biocacheUrl + '/occurrences/' + el.uuid + '">View details of this record</a>' +
            '<br><br>If this image is incorrectly<br>identified please flag an<br>issue on the <a href=' + SHOW_CONF.biocacheUrl +
            '/occurrences/' + el.uuid + '>record.<br></div>';
    }
    return detailHtml;
}

function loadBhl() {
    loadBhl(0, 10, false);
}

/**
 * BHL search to populate literature tab
 *
 * @param start
 * @param rows
 * @param scroll
 */
function loadBhl(start, rows, scroll) {
    if (!start) {
        start = 0;
    }
    if (!rows) {
        rows = 10;
    }
    var source = SHOW_CONF.bhlUrl;
    var taxonName = SHOW_CONF.scientificName ;
    var synonyms = SHOW_CONF.synonyms;
    var i;
    var query = ""; // = taxonName.split(/\s+/).join(" AND ") + synonyms;
    if (taxonName) {
        query = query + "s=" + encodeURIComponent(taxonName);
    }
    if (synonyms) {
        for (i = 0; i < synonyms.length; i++) {
            if (synonyms[i] == taxonName) {
                continue;
            }
            if (query.length > 0)
                query = query + "&";
            query = query + "s=" + encodeURIComponent(synonyms[i]);
        }
    }

    if (!query) {
        return cancelSearch("No names were found to search BHL");
    }

    var url = source + "?" + query + '&start=' + start + "&rows=" + rows;
    var buf = "";
    $("#status-box").css("display", "block");
    $("#bhl-results-list").html("");

    $("#bhl-results-list").load(url);
} // end doSearch

function cancelSearch(msg) {
    $("#status-box").css("display", "none");
    $("#solr-results").html(msg);
    return true;
}

let distributions = []
var distributionsIdx = 0
function loadExpertDistroMap() {
    var url = SHOW_CONF.layersServiceUrl + "/distribution/lsids/" + SHOW_CONF.guid;
    $.getJSON(url, function(data){
        if (data) {
            $.each(data, function (idx, distribution) {
                var record = {
                    url: distribution.imageUrl,
                    name: distribution.area_name,
                    dr: distribution.data_resource_uid
                }

                if (record.dr) {
                    $.getJSON(SHOW_CONF.collectoryUrl + "/ws/dataResource/" + record.dr, function(collectoryData) {
                        record.providerName = collectoryData.name
                        distributions.push(record)

                        showDistribution()
                    })
                }
            })
            $('#expertDistroCount').text(' (' + data.length + ')')
        }
    })
}

function nextDistribution() {
    if (distributionsIdx < distributions.length) {
        distributionsIdx = distributionsIdx + 1
    }

    showDistribution()
}

function prevDistribution() {
    if (distributionsIdx > 0) {
        distributionsIdx = distributionsIdx - 1
    }

    showDistribution()
}

function showDistribution() {
    $("#expertDistroDiv img").attr("src", distributions[distributionsIdx].url);
    $("#dataResourceAreaName").text((distributionsIdx + 1) + ": " + distributions[distributionsIdx].name)
    if (distributions[distributionsIdx].dr) {
        var attr = $('<a>').attr('href', SHOW_CONF.collectoryUrl + '/public/show/' + distributions[distributionsIdx].dr).text(distributions[distributionsIdx].providerName)
        $("#expertDistroDiv #dataResource").html(attr);
    }

    $("#expertDistroDiv").show();

    if (distributionsIdx > 0) {
        $("#expertDistroPrev").prop( "disabled", false );
    } else {
        $("#expertDistroPrev").prop( "disabled", true );
    }

    if (distributionsIdx < distributions.length - 1) {
        $("#expertDistroNext").prop( "disabled", false );
    } else {
        $("#expertDistroNext").prop( "disabled", true );
    }
}

function expandImageGallery(btn) {
    if(!$(btn).hasClass('.expand-image-gallery')){
        $(btn).parent().find('.collapse-image-gallery').removeClass('btn-primary');
        $(btn).addClass('btn-primary');

        $(btn).parents('.image-section').find('.taxon-gallery').slideDown(400)
    }
}

function collapseImageGallery(btn) {
    if(!$(btn).hasClass('.collapse-image-gallery')){
        $(btn).parent().find('.expand-image-gallery').removeClass('btn-primary');
        $(btn).addClass('btn-primary');

        $(btn).parents('.image-section').find('.taxon-gallery').slideUp(400)
    }
}
