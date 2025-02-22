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

package au.org.ala.bie

import au.org.ala.bie.webapp2.SearchRequestParamsDTO
import grails.converters.JSON
import org.grails.web.json.JSONObject

class BieService {

    def webClientService
    def grailsApplication

    def searchBie(SearchRequestParamsDTO requestObj) {

        def queryUrl = grailsApplication.config.bie.index.url + "/search?" + requestObj.getQueryString() +
                "&facets=" + grailsApplication.config.facets + "&q.op=OR"

        //add a query context for BIE - to reduce taxa to a subset
        if(grailsApplication.config.bieService.queryContext){
            queryUrl = queryUrl + "&" + URLEncoder.encode(grailsApplication.config.bieService.queryContext, "UTF-8")
        }

        //add a query context for biocache - this will influence record counts
        if(grailsApplication.config.biocacheService.queryContext){
            queryUrl = queryUrl + "&bqc=" + URLEncoder.encode(grailsApplication.config.biocacheService.queryContext, "UTF-8")
        }

        def json = webClientService.get(queryUrl)
        JSON.parse(json)
    }

    def getSpeciesList(guid){
        if(!guid || !grailsApplication.config.speciesList.baseURL){
            return null
        }
        try {
            def json = webClientService.get((grailsApplication.config.speciesListService.baseURL?: grailsApplication.config.speciesList.baseURL) + "/ws/species/" + guid.replaceAll(/\s+/,'+') + "?isBIE=true", true)
            return JSON.parse(json)
        } catch(Exception e){
            //handles the situation where time out exceptions etc occur.
            log.error("Error retrieving species list.", e)
            return []
        }
    }

    def getTaxonConcept(guid) {
        if (!guid && guid != "undefined") {
            return null
        }
        def json = webClientService.get(grailsApplication.config.bie.index.url + "/taxon/" + guid.replaceAll(/\s+/,'+'))
        //log.debug "ETC json: " + json
        try{
            JSON.parse(json)
        } catch (Exception e){
            log.warn "Problem retrieving information for Taxon: " + guid
            null
        }
    }

    def getClassificationForGuid(guid) {
        def url = grailsApplication.config.bie.index.url + "/classification/" + guid.replaceAll(/\s+/,'+')
        def json = webClientService.getJson(url)
        log.debug "json type = " + json
        if (json instanceof JSONObject && json.has("error")) {
            log.warn "classification request error: " + json.error
            return [:]
        } else {
            log.debug "classification json: " + json
            return json
        }
    }

    def getChildConceptsForGuid(guid) {
        def url = grailsApplication.config.bie.index.url + "/childConcepts/" + guid.replaceAll(/\s+/,'+')

        if(grailsApplication.config.bieService.queryContext){
            url = url + "?" + URLEncoder.encode(grailsApplication.config.bieService.queryContext, "UTF-8")
        }

        def json = webClientService.getJson(url).sort() { it.rankID?:0 }

        if (json instanceof JSONObject && json.has("error")) {
            log.warn "child concepts request error: " + json.error
            return [:]
        } else {
            log.debug "child concepts json: " + json
            return json
        }
    }
}