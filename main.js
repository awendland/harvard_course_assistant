'use strict';

var app = angular.module('QGuideRevamped', []);

app.controller('CourseSearch', ['$scope', '$http', 'courseData', function ($scope, $http, courseData) {
	// Set the loading indicator to initially show
	$scope.loaded = false;
	$scope.error = null;
	$scope.pageStart = 0;
	$scope.perPage = 30;
	var courses = [];
	$scope.filteredCourses = [];

	function flattenObjectValuesToArray(obj) {
		var stringArr = [];
		for (var prop in obj) {
			if (!obj.hasOwnProperty(prop) || !obj[prop]) continue;
			if (obj[prop].constructor === Array || obj[prop].constructor === Object)
				stringArr = stringArr.concat(flattenObjectValuesToArray(obj[prop]));
			else
				stringArr.push(obj[prop]);
		}
		return stringArr;
	}

	// Load the course data from localStorage or from the network
	courseData.courses().then(
		function dataLoaded(newCourses) {
			$scope.loaded = true;
			$scope.error = null;
			newCourses.sort(function sortCourses(c1, c2) {
				return c1.title.replace(/['"`(]/g, "")
					.localeCompare(c2.title.replace(/['"`(]/g, ""));
			})
			newCourses.map(function addQueryFieldToCourses(course) {
				course["_query_string"] = (flattenObjectValuesToArray(course) || []).join("\n");
			});
			courses = newCourses;
			updateCourses();
		}, function errorLoadingData(errorResp) {
			console.log(errorResp);
			var statusCodeFamily = Math.floor(errorResp.status / 100);
			if (statusCodeFamily == 5) {
				$scope.error = "Something is wrong with the courses server right now (" + errorResp.status + ")";
			} else {
				$scope.error = "An unknown error occurred when trying to load the courses data (" + errorResp.status + ")";
			}
		});

	$scope.pageChange = function pageChange(direction) {
		var dir = Math.sign(direction);
		$scope.pageStart = Math.max($scope.pageStart + (dir * $scope.perPage), 0);
		paginateCourses();
	}

	$scope.$watch('query', function watchCourse(newVal, oldVal) {
		updateCourses();
	});

	function updateCourses() {
		filterCourses($scope.query);
		$scope.pageStart = 0;
		paginateCourses();
	}

	var lastFilter = "";
	function filterCourses(filter) {
		if (!filter || filter == "") {
			$scope.filteredCourses = courses;
			return;
		}
		var arrayToFilter = filter.indexOf(lastFilter) == 0
			? $scope.filteredCourses
			: courses;
		$scope.filteredCourses = arrayToFilter.filter(function filterCourses(course) {
			var lowerCaseQueryString = course["_query_string"].toLowerCase();
			var filterItems = filter.split(" ");
			for (var index = 0; index < filterItems.length; index++) {
				if (lowerCaseQueryString.indexOf(filterItems[index].toLowerCase()) < 0)
					return false;
			}
			return true;
		});
		lastFilter = filter;
	}

	function paginateCourses() {
		$scope.paginatedCourses = $scope.filteredCourses.slice(
			Math.min($scope.pageStart, courses.length),
			Math.min($scope.perPage + $scope.pageStart, courses.length));
	}
}]);

app.factory('courseData', ['$q', '$http', function ($q, $http) {
	function getLatestData() {
		var deferred = $q.defer();
		$http.get('harvard_courses.json').then(
			function success(resp) {
				var json = resp["data"];
				localStorage.setItem('courses', JSON.stringify(json["results"]));
				localStorage.setItem('courses_version_id', json["id"]);
				deferred.resolve(json["results"]);
			}, function error(resp) {
				deferred.reject(resp);
			});
		return deferred.promise;
	}

	return {
		courses: function() {
			var deferred = $q.defer();
			var storedcoursesVersion = localStorage.getItem('courses_version_id');
			if (storedcoursesVersion == null) {
				return getLatestData();
			} else {
				$http.get('harvard_courses_version.json').then(
					function success(resp) {
						var json = resp["data"];
						if (json["latest_id"] != storedcoursesVersion || localStorage.getItem('courses') == null) {
							getLatestData().then(deferred.resolve, deferred.reject);
						} else {
							deferred.resolve(JSON.parse(localStorage.getItem('courses')));
						}
					}, function error(resp) {
						deferred.reject(resp);
					});
				return deferred.promise;
			}
		}
	}
}]);