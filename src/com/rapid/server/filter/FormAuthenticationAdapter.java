/*

Copyright (C) 2014 - Gareth Edwards / Rapid Information Systems

gareth.edwards@rapid-is.co.uk


This file is part of the Rapid Application Platform

RapidSOA is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version. The terms require you to include
the original copyright, and the license notice in all redistributions.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
in a file named "COPYING".  If not, see <http://www.gnu.org/licenses/>.

*/

package com.rapid.server.filter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.apache.log4j.Logger;

import com.rapid.core.Application;
import com.rapid.server.RapidHttpServlet.RapidRequest;

public class FormAuthenticationAdapter extends RapidAuthenticationAdapter {
		
	private static Logger _logger = Logger.getLogger(RapidAuthenticationAdapter.class);
	
	public FormAuthenticationAdapter(ServletContext servletContext) {
		 super(servletContext);		
		_logger.info("Form authentication filter initialised.");
		
	}
		
	@Override
	public ServletRequest process(ServletRequest req, ServletResponse res) throws IOException, ServletException {
			
		// cast the ServletRequest to a HttpServletRequest
		HttpServletRequest request = (HttpServletRequest) req;
		
		// log the full request
		_logger.trace("FormAuthenticationAdapter request : " + request.getRequestURL() + (request.getQueryString() == null ? "" : "?" + request.getQueryString()));
		
		// now get just the resource path
		String requestPath = request.getServletPath();
						
		// if it's a resource that requires authentication
		if (requestPath.contains("/~") || "/".equals(requestPath) || requestPath.contains("login.jsp") || requestPath.contains("index.jsp") || requestPath.contains("/rapid") || requestPath.contains("design.jsp") || requestPath.contains("designpage.jsp")  || requestPath.contains("/designer")) {
			
			_logger.trace("FormAuthenticationAdapter checking authorisation");
			
			String userName = null;
			String userPassword = null;
			
			HttpSession session = request.getSession();
			
			// look in the session for username
			userName = (String) session.getAttribute(RapidFilter.SESSION_VARIABLE_USER_NAME);

			// cast response to http
			HttpServletResponse response = (HttpServletResponse) res;
			
			if (userName == null) {
				
				_logger.trace("No userName found in session");
																				
				// look for a sessionRequestPath attribute in the session
				String sessionRequestPath = (String) session.getAttribute("requestPath");
				
				// look in the request for the username
				userName = request.getParameter("userName");
				// look in the request for the password
				userPassword = request.getParameter("userPassword");
			
				if (userName == null) {
					
					_logger.trace("No userName found in request");
																									
					// if we are attempting to authorise 
					if (requestPath.contains("login.jsp") && sessionRequestPath != null) {
												
						// check the url for a requestPath
						String urlRequestPath = request.getParameter("requestPath");
						// overide the session one if so
						if (urlRequestPath != null) session.setAttribute("requestPath", urlRequestPath);
						// progress to the next step in the filter
						return req;
						
					}
					
					String acceptHeader = request.getHeader("Accept");
					if (acceptHeader == null) acceptHeader = ""; 
					
					// if this is json just send a 401
					if (acceptHeader.contains("application/json")) {
						
						// set the 401 - access denied
						response.sendError(401);
												
					} else {
						
						// retain the request path less the leading /
						String authorisationRequestPath = requestPath.substring(1);
						// replace designpage.jsp with design.jsp to get us out of the parent
						authorisationRequestPath = authorisationRequestPath.replace("designpage.jsp", "design.jsp");
						// append the query string if there was one
						if (request.getQueryString() != null) authorisationRequestPath += "?" + request.getQueryString(); 						
						// retain the request path in the session
						session.setAttribute("requestPath", authorisationRequestPath);
						
						// send a redirect to load the login page
						response.sendRedirect("login.jsp");
						
					}
									
					// return immediately
					return null;
					
				} else {
					
					_logger.trace("userName found in request");
					
					// remember whether we are authorised for at least one application
					boolean authorised = false;
					
					// get the map of applications
					Map<String,Application> applications = (Map<String,Application>) getServletContext().getAttribute("applications");
					
					// if there are some applications
					if (applications != null) {
						// loop them
						for (String key : applications.keySet()) {
							try {
								// get the application
								Application application = applications.get(key);
								// get a Rapid request
								RapidRequest rapidRequest = new RapidRequest(request);
								// see if the user is known to this application
								authorised = application.getSecurity().checkUserPassword(rapidRequest, userName, userPassword);
								// we can exit if so as we only need one
								if (authorised) break;								
							} catch (Exception ex) {}
						}
					}
					
					// we passed authorisation so redirect the client to the resource they wanted
					if (authorised) {
						
						// retain username in the session
						session.setAttribute(RapidFilter.SESSION_VARIABLE_USER_NAME, userName);
						
						// log that authentication was granted
						_logger.debug("FormAuthenticationAdapter authenticated " + userName);
						
						// make the sessionRequest path the root just in case it was null (or login.jsp itself)
						if (sessionRequestPath == null || "login.jsp".equals(sessionRequestPath)) sessionRequestPath = ".";
												
						// if we had a requestApp in the sessionRequestPath, go straight to the app
						if (sessionRequestPath.indexOf("requestApp") > 0) {
							// split the parts
							String[] requestAppParts = sessionRequestPath.split("=");
							// if we have a second part with the appId in it
							if (requestAppParts.length > 1) {
								// set the sessionRequestPath to the appId
								sessionRequestPath = "~?a=" + requestAppParts[1];
							}
 						}
						
						// remove the authorisation session attribute
						session.setAttribute("requestPath", null);
						
						// send a redirect to reload what we wanted before
						response.sendRedirect(sessionRequestPath);
						
						// return to client immediately
						return null;
						
					} else {
						
						// retain the authorisation attempt in the session
						session.setAttribute("message", "Your user name / password has not been recognised");
						
						// send a redirect to load the login page
						response.sendRedirect("login.jsp");
											
						// return immediately
						return null;
						
					}
																			
				}
												
			}
			
			// if we are requesting the login.jsp but have authenticated go to index instead
			if (requestPath.contains("login.jsp")) {
				
				// send a redirect to load the index page
				response.sendRedirect("index.jsp");
				
				// return immediately
				return null;
				
			}
				
			// return the request which will process the chain
			// hold a reference to the original request
			HttpServletRequest filteredReq = request;
			
			// wrap the request if it is not a rapid request (with our username and principle)
			if(!(request instanceof RapidRequestWrapper)) filteredReq = new RapidRequestWrapper(request, userName);
			
			return filteredReq;
			
		} else {
									
			// proceed to the next step
			return req;
			
		}
						
	}

}
