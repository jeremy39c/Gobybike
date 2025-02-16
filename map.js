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
                'line-color': "hsl(117, 70%, 64%)",
                'line-width': 3,
                'line-opacity': 0.24
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

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

map.on('load', () => {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);

        const stations = jsonData.data.stations
        console.log('Stations Array:', stations);

        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', 4)
            .attr('fill', 'steelblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.7);
        
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

    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});
