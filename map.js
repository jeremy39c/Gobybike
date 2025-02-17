mapboxgl.accessToken = 'pk.eyJ1IjoiamVyZW15MzljIiwiYSI6ImNtNzZxY3puNTBhbHIya285aWlieWk1MjYifQ.tUCwDXIInQEIwZAX-NZsQA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/jeremy39c/cm76rcl4700r401reeh85g34j',
    center: [-71.10253138178822, 42.36929373398382],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
});

map.on('load', () => {
    function addLaneLayer(id, src) {
        map.addLayer({
            id: id,
            type: 'line',
            source: src,
            paint: {
                'line-color': "hsl(112, 77%, 37%)",
                'line-width': 3,
                'line-opacity': 0.5
            }
        });
    }
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    addLaneLayer('boston-bike-lanes', 'boston_route');
    addLaneLayer('cambridge-bike-lanes', 'cambridge_route');
});

const svg = d3.select('#map').select('svg');

let stations = [];
let trips = [];
let circles = [];
let arrivals = [];
let departures = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

let timeFilter = -1;

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
    } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
    }
}
timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay();

map.on('load', () => {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonurl).then(jsonData => {
        stations = jsonData.data.stations;
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });

    const csvurl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    d3.csv(csvurl).then(trips => {
        departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
        );
        arrivals = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.end_station_id,
        );
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        let radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
        
        let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
    
        circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', d => radiusScale(d.totalTraffic))
            .attr('fill', 'steelblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.77)
            .each(function(d) {
                d3.select(this)
                    .append('title')
                    .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            })
            .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));
        
        function getCoords(station) {
            const point = new mapboxgl.LngLat(+station.lon, +station.lat);
            const { x, y } = map.project(point);
            return { cx: x, cy: y };
        }
        
        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)
                .attr('cy', d => getCoords(d).cy);
        }
    
        updatePositions();

        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        for (let trip of trips) {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);

            let startedMinutes = minutesSinceMidnight(trip.started_at);
            departuresByMinute[startedMinutes].push(trip);

            let endedMinutes = minutesSinceMidnight(trip.ended_at);
            arrivalsByMinute[endedMinutes].push(trip);

        }

        function minutesSinceMidnight(date) {
            return date.getHours() * 60 + date.getMinutes();
        }
        function filterByMinute(tripsByMinute, minute) {
            let minMinute = (minute - 60 + 1440) % 1440;
            let maxMinute = (minute + 60) % 1440;
          
            if (minMinute > maxMinute) {
                let beforeMidnight = tripsByMinute.slice(minMinute);
                let afterMidnight = tripsByMinute.slice(0, maxMinute);
                return beforeMidnight.concat(afterMidnight).flat();
            } else {
                return tripsByMinute.slice(minMinute, maxMinute).flat();
            }
        }
        function filterTripsbyTime() {
            if(timeFilter === -1) {
                filteredStations = stations.map((station) => {
                    station = { ...station };
                    let id = station.short_name;
                    station.arrivals = arrivals.get(id) ?? 0;
                    station.departures = departures.get(id) ?? 0;
                    station.totalTraffic = station.arrivals + station.departures;
                    return station;
                });
            }
            else {
                $: filteredDepartures = d3.rollup(
                    filterByMinute(departuresByMinute, timeFilter),
                    (v) => v.length,
                    (d) => d.start_station_id,
                );
                $: filteredArrivals = d3.rollup(
                        filterByMinute(arrivalsByMinute, timeFilter),
                        (v) => v.length,
                        (d) => d.end_station_id,
                    );
                filteredStations = stations.map((station) => {
                    station = { ...station };
                    let id = station.short_name;
                    station.arrivals = filteredArrivals.get(id) ?? 0;
                    station.departures = filteredDepartures.get(id) ?? 0;
                    station.totalTraffic = station.arrivals + station.departures;
                    return station;
                });
            }
            
            let radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range(timeFilter === -1 ? [0, 25] : [3, 50]);

            circles.remove();

            circles = svg.selectAll('circle')
                .data(filteredStations, d => d.id)
                .enter()
                .append('circle')
                .attr('r', d => radiusScale(d.totalTraffic))
                .attr('fill', 'steelblue')
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .attr('opacity', 0.77)
                .each(function(d) {
                    d3.select(this)
                        .append('title')
                        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                })
                .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));
                
            updatePositions();
        }
        timeSlider.addEventListener('input', filterTripsbyTime);
    }).catch(error => {
        console.error('Error loading CSV:', error);
    });
});