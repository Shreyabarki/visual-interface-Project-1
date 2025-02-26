document.addEventListener("DOMContentLoaded", function () {
    const width = 600, height = 400;
    const margin = { top: 40, right: 40, bottom: 50, left: 70 };

    const scatterSvg = d3.select("#scatterplot").append("svg").attr("width", width).attr("height", height);
    const histWidth = 400, histHeight = 300;

    const povertyHistSvg = d3.select("#poverty-histogram").append("svg").attr("width", histWidth).attr("height", histHeight);
    const bloodPressureHistSvg = d3.select("#blood-pressure-histogram").append("svg").attr("width", histWidth).attr("height", histHeight);
    const mapSvg = d3.select("#map").attr("width", width * 2).attr("height", height);

    let currentAttribute = "poverty_perc";
    let filteredData = []; 

    const attributeColors = {
        "poverty_perc": "#4682B4",  // Steel Blue for poverty percentage
        "percent_high_blood_pressure": "#4682B4",  // Steel Blue for high blood pressure
        "median_household_income": "#4682B4",  // Steel Blue for median household income
        "percent_no_heath_insurance": "#4682B4"  // Steel Blue for no health insurance
    };
    
    const attributeNames = {
        "poverty_perc": "Poverty (%)",
        "percent_high_blood_pressure": "High Blood Pressure (%)",
        "median_household_income": "Median Household Income ($)",
        "percent_no_heath_insurance": "No Health Insurance (%)"
    };
    

    const tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("font-size", "14px");

    d3.csv("national_health_data_2024.csv").then(data => {
        data.forEach(d => {
            d.id = d.cnty_fips; 
            d.poverty_perc = +d.poverty_perc;
            d.percent_high_blood_pressure = +d.percent_high_blood_pressure;
            d.median_household_income = +d.median_household_income;
            d.percent_no_heath_insurance = +d.percent_no_heath_insurance;
        });

        filteredData = data;

        const dropdown = d3.select("#scatter-dropdown");
        Object.keys(attributeNames).forEach(attr => {
            dropdown.append("option").attr("value", attr).text(attributeNames[attr]);
        });

        function updateVisualizations() {
            updateScatterplot();
            updateHistogram(povertyHistSvg, currentAttribute);
            updateHistogram(bloodPressureHistSvg, "percent_high_blood_pressure");
            updateMap();
        }

        function updateScatterplot() {
            const xScale = d3.scaleLinear().domain(d3.extent(data, d => d[currentAttribute])).range([margin.left, width - margin.right]);
            const yScale = d3.scaleLinear().domain(d3.extent(data, d => d.percent_high_blood_pressure)).range([height - margin.bottom, margin.top]);

            scatterSvg.selectAll("g").remove();

            scatterSvg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(xScale));
            scatterSvg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(yScale));

            scatterSvg.selectAll("circle")
                .data(filteredData)
                .join("circle")
                .attr("cx", d => xScale(d[currentAttribute]))
                .attr("cy", d => yScale(d.percent_high_blood_pressure)) // Adjust as per the attribute for y-axis
                .attr("r", 5)
                .attr("fill", attributeColors[currentAttribute])  // Steel Blue color for the scatter plot points
                .attr("opacity", 0.7)
                .on("mouseover", function (event, d) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`${attributeNames[currentAttribute]}: ${d[currentAttribute]}%<br>High Blood Pressure: ${d.percent_high_blood_pressure}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(500).style("opacity", 0);
                });

            const brush = d3.brush()
                .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
                .on("end", brushed);

            scatterSvg.append("g").call(brush);

            function brushed({ selection }) {
                if (!selection) {
                    filteredData = data; 
                } else {
                    const [[x0, y0], [x1, y1]] = selection;
                    filteredData = data.filter(d =>
                        xScale(d[currentAttribute]) >= x0 && xScale(d[currentAttribute]) <= x1 &&
                        yScale(d.percent_high_blood_pressure) >= y0 && yScale(d.percent_high_blood_pressure) <= y1
                    );
                }
                updateVisualizations();
            }
        }

        function updateHistogram(svg, dataKey) {
            svg.selectAll("*").remove();

            const x = d3.scaleLinear().domain(d3.extent(filteredData, d => d[dataKey])).range([0, histWidth - 100]);
            const bins = d3.bin().domain(x.domain()).thresholds(20)(filteredData.map(d => d[dataKey]));
            const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([histHeight - 50, 0]);

            const g = svg.append("g").attr("transform", "translate(50,30)");

            g.append("g").attr("transform", `translate(0, ${histHeight - 50})`).call(d3.axisBottom(x));
            g.append("g").call(d3.axisLeft(y));

            g.selectAll("rect")
                .data(bins)
                .join("rect")
                .attr("x", d => x(d.x0))
                .attr("y", d => y(d.length))
                .attr("width", d => x(d.x1) - x(d.x0) - 2)
                .attr("height", d => histHeight - 50 - y(d.length))
                .attr("fill", attributeColors[dataKey])  // Steel Blue color for histogram bars
                .attr("opacity", 0.7);
        }

        function updateMap() {
            d3.json("counties-10m.json").then(us => {
                const projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(width);
                const path = d3.geoPath().projection(projection);

                const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(d3.extent(filteredData, d => d[currentAttribute]));

                mapSvg.selectAll("path")
                    .data(topojson.feature(us, us.objects.counties).features)
                    .join("path")
                    .attr("d", path)
                    .attr("fill", d => {
                        const county = filteredData.find(c => c.id == d.id);
                        return county ? colorScale(county[currentAttribute]) : "#ddd";
                    });
            });
        }

        dropdown.on("change", function () {
            currentAttribute = this.value;
            filteredData = data;
            updateVisualizations();
        });

        updateVisualizations();
    });
});
