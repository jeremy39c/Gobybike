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
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

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

        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range(timeFilter === -1 ? [0, 25] : [3, 50]);
    
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
        });
        
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
        }

        function minutesSinceMidnight(date) {
            return date.getHours() * 60 + date.getMinutes();
        }
        function filterTripsbyTime() {
            filteredTrips = timeFilter === -1
                ? trips
                : trips.filter((trip) => {
                    const startedMinutes = minutesSinceMidnight(trip.started_at);
                    const endedMinutes = minutesSinceMidnight(trip.ended_at);
                    return (
                        Math.abs(startedMinutes - timeFilter) <= 60 ||
                        Math.abs(endedMinutes - timeFilter) <= 60
                    );
                });
            $: filteredDepartures = d3.rollup(
                    filteredTrips,
                    (v) => v.length,
                    (d) => d.start_station_id,
                );
            $: filteredArrivals = d3.rollup(
                    filteredTrips,
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
                });
                updatePositions();
        }
        timeSlider.addEventListener('input', filterTripsbyTime);
    }).catch(error => {
        console.error('Error loading CSV:', error);
    });
});