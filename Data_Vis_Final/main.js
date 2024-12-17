const margin = { top: 50, right: 50, bottom: 50, left: 50 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

// Scales
const xScale = d3.scaleLinear().domain([2010, 2024]).range([0, width]);
const yScaleLeft = d3.scaleLinear().range([height, 0]);
const yScaleRight = d3.scaleLinear().range([height, 0]);

// Axes
const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
const yAxisLeft = d3.axisLeft(yScaleLeft);
const yAxisRight = d3.axisRight(yScaleRight);


// Load team data
d3.csv("team_stats.csv").then(data => {
    teamData = data.map(d => ({
        year: +d.Year,
        team: d.Team,
        avg_launch_angle: +d.Launch_A,
        avg_exit_velocity: +d.Exit_Velo,
        hard_hit_rate: +d.Hard_Hit,
        batting_avg: +d.BA,
        Logo: d.Logo
    }));

    console.log("Loaded Team Data:", teamData);
});


// Load league data
d3.csv("MLBstats.csv").then(data => {
    data.forEach(d => {
        d.year = +d.Season;
        d.homeruns_per_game = +d.AVGHR;
        d.strikeouts_per_game = +d.AVGSO;
        d.avg_launch_angle = +d.Launch_Angle || null;
        d.avg_exit_velocity = +d.Exit_Velocity || null;
        d.batting_avg = +d.AVGBA;
        d.hard_hit_rate = +d.Hard_Hit_Rate || null;
        d.fly_ball_pct = +d.FB || null;
        d.ground_ball_pct = +d.GB || null;
        d.line_drive_pct = +d.LD || null;
        d.popup_pct = +d.PU || null;
    });
    console.log("Loaded League Data:", data);

    

    // Set domains
    yScaleLeft.domain([0.7, d3.max(data, d => d.homeruns_per_game)]);
    yScaleRight.domain([5, d3.max(data, d => d.strikeouts_per_game)]);

    // Add axes
    svg.append("g").attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

    svg.append("g").attr("class", "y-axis-left").call(yAxisLeft);
    svg.append("g").attr("class", "y-axis-right")
        .attr("transform", `translate(${width}, 0)`)
        .call(yAxisRight);

    // Draw lines
    const lineLeft = d3.line()
        .defined(d => d.homeruns_per_game !== null) // 確保非 null 數據
        .x(d => xScale(d.year))
        .y(d => yScaleLeft(d.homeruns_per_game));

    const lineRight = d3.line()
        .defined(d => d.strikeouts_per_game !== null)
        .x(d => xScale(d.year))
        .y(d => yScaleRight(d.strikeouts_per_game));

    svg.append("path")
        .datum(data)
        .attr("class", "line-left")
        .attr("d", lineLeft)
        .style("stroke", "blue")
        .style("fill", "none"); // 確保沒有填充

    svg.append("path")
        .datum(data)
        .attr("class", "line-right")
        .attr("d", lineRight)
        .style("stroke", "red")
        .style("fill", "none"); // 確保沒有填充

    // Add left Y-axis label (homeruns_per_game)
    svg.append("text")
        .attr("class", "y-axis-label-left")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-35, ${height / 2}) rotate(-90)`) // 旋轉文字
        .text("Homeruns per Game")
        .style("fill", "blue");

    // Add right Y-axis label (strikeouts_per_game)
    svg.append("text")
        .attr("class", "y-axis-label-right")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${width + 30}, ${height / 2}) rotate(90)`) // 旋轉文字
        .text("Strikeouts per Game")
        .style("fill", "red");


    // 在 2015 年位置添加垂直線
    svg.append("line")
        .attr("x1", xScale(2015)) 
        .attr("x2", xScale(2015))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "Yellow")
        .attr("stroke-width", 2)
        .attr("opacity", 0.5);

    // Brush 設定
    const brush = d3.brushX()
        .extent([[xScale(2015), 0], [xScale(2024), height]])
        .on("brush end", brushed);

    svg.append("g").attr("class", "brush").call(brush);
    

    function brushed(event) {
        if (!event.selection) return;
    
        const [x0, x1] = event.selection.map(xScale.invert);
        const roundedStart = Math.round(x0);
        const roundedEnd = Math.round(x1);

        // 篩選選中年份內的球隊數據
        const filteredTeams = teamData.filter(d => d.year >= roundedStart && d.year <= roundedEnd);

        console.log("filteredTeams", filteredTeams);

        // 獲取唯一年份列表
        const selectedYears = [...new Set(filteredTeams.map(d => d.year))];
        console.log("selectedYears", selectedYears);


        // 限制最多選擇 3 年
        let filteredYears = data.filter(d => d.year >= Math.floor(x0) && d.year <= Math.ceil(x1));
        if (filteredYears.length > 3) {
            const adjustedSelection = [filteredYears[0].year, filteredYears[1].year + 1].map(xScale);

            // 暫時移除事件處理
            svg.select(".brush")
                .on("brush", null)
                .on("end", null);

            // 調整選取範圍
            d3.select(this).call(brush.move, adjustedSelection);

            // 恢復事件處理
            svg.select(".brush")
                .on("brush", brushed)
                .on("end", brushed);
            return;
        }

        // 按年份分組並生成圖表
        updateYearlyCharts(filteredTeams, selectedYears, data); // 傳遞聯盟資料
    }

});


function drawScatter1(containerId, filteredData) {
    const scatter1Svg = d3.select(containerId);
    scatter1Svg.selectAll("*").remove();

    // 固定 X 軸刻度範圍
    const xDomain = [8, 16]; // 修改為新範圍
    const yDomain = [85, 91]; // 修改為新範圍

    const xScale = d3.scaleLinear()
        .domain(xDomain)
        .range([50, 450]);

    const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range([250, 50]);

    // 計算 X 和 Y 軸中軸位置
    const xMid = (xDomain[0] + xDomain[1]) / 2; // X 軸中點
    const yMid = (yDomain[0] + yDomain[1]) / 2; // Y 軸中點

    // 繪製 X 軸
    scatter1Svg.append("g")
        .attr("transform", "translate(0, 250)") // 放置在圖表底部
        .call(d3.axisBottom(xScale).ticks(5));

    // 繪製 Y 軸
    scatter1Svg.append("g")
        .attr("transform", "translate(50, 0)") // 放置在圖表左側
        .call(d3.axisLeft(yScale).ticks(5));

    // 添加 X 軸中軸線
    scatter1Svg.append("line")
        .attr("x1", xScale(xMid)) // 中軸位置為 X 軸中點
        .attr("x2", xScale(xMid))
        .attr("y1", yScale(yDomain[0])) // Y 軸最小值
        .attr("y2", yScale(yDomain[1])) // Y 軸最大值
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 2")
        .attr("stroke-width", 1);

    // 添加 Y 軸中軸線
    scatter1Svg.append("line")
        .attr("x1", xScale(xDomain[0])) // X 軸最小值
        .attr("x2", xScale(xDomain[1])) // X 軸最大值
        .attr("y1", yScale(yMid)) // 中軸位置為 Y 軸中點
        .attr("y2", yScale(yMid))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 2")
        .attr("stroke-width", 1);

    // 添加數據點並用隊徽取代圓點
    scatter1Svg.selectAll(".team-logo")
        .data(filteredData)
        .enter()
        .append("image") // 使用 <image> 標籤顯示圖片
        .attr("class", "team-logo")
        .attr("x", d => xScale(d.avg_launch_angle) - 10) // X 軸位置，-10 是調整使隊徽居中
        .attr("y", d => yScale(d.avg_exit_velocity) - 10) // Y 軸位置，-10 是調整使隊徽居中
        .attr("width", 20)  // 隊徽寬度
        .attr("height", 20) // 隊徽高度
        .attr("xlink:href", d => d.Logo); // 使用資料中的 Logo 欄位作為圖片路徑


    // 添加 X 軸說明
    scatter1Svg.append("text")
        .attr("x", (450 + 50) / 2) // X 軸標籤居中
        .attr("y", 290) // 放置在 X 軸下方
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Avg Launch Angle (degrees)");

    // 添加 Y 軸說明
    scatter1Svg.append("text")
        .attr("x", -125) // 旋轉後的位置調整
        .attr("y", 20) // 距離 Y 軸的水平偏移
        .attr("transform", "rotate(-90)") // 垂直顯示
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Avg Exit Velocity (mph)");
}


function drawScatter2(containerId, filteredData) {
    const scatter2Svg = d3.select(containerId);
    scatter2Svg.selectAll("*").remove();

    // 固定 X 軸和 Y 軸範圍
    const xDomain = [0.212, 0.282];
    const yDomain = [25, 45];

    const xScale = d3.scaleLinear()
        .domain(xDomain)
        .range([50, 450]);

    const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range([250, 50]);

    // 計算 X 和 Y 軸中軸位置
    const xMid = (xDomain[0] + xDomain[1]) / 2; // X 軸中點
    const yMid = (yDomain[0] + yDomain[1]) / 2; // Y 軸中點

    // 繪製 X 軸
    scatter2Svg.append("g")
        .attr("transform", "translate(0, 250)")
        .call(d3.axisBottom(xScale).ticks(5));

    // 繪製 Y 軸
    scatter2Svg.append("g")
        .attr("transform", "translate(50, 0)")
        .call(d3.axisLeft(yScale).ticks(5));

    // 添加 X 軸中軸線
    scatter2Svg.append("line")
        .attr("x1", xScale(xMid))
        .attr("x2", xScale(xMid))
        .attr("y1", yScale(yDomain[0]))
        .attr("y2", yScale(yDomain[1]))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 2")
        .attr("stroke-width", 1);

    // 添加 Y 軸中軸線
    scatter2Svg.append("line")
        .attr("x1", xScale(xDomain[0]))
        .attr("x2", xScale(xDomain[1]))
        .attr("y1", yScale(yMid))
        .attr("y2", yScale(yMid))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 2")
        .attr("stroke-width", 1);


    // 添加數據點並用隊徽取代圓點
    scatter2Svg.selectAll(".team-logo")
        .data(filteredData)
        .enter()
        .append("image") // 使用 <image> 標籤顯示圖片
        .attr("class", "team-logo")
        .attr("x", d => xScale(d.batting_avg) - 10) // X 軸位置，-10 是調整使隊徽居中
        .attr("y", d => yScale(d.hard_hit_rate) - 10) // Y 軸位置，-10 是調整使隊徽居中
        .attr("width", 20)  // 隊徽寬度
        .attr("height", 20) // 隊徽高度
        .attr("xlink:href", d => d.Logo); // 使用資料中的 Logo 欄位作為圖片路徑

    // 添加 X 軸標籤
    scatter2Svg.append("text")
        .attr("x", (450 + 50) / 2) // X 軸標籤居中
        .attr("y", 290) // 放置在 X 軸下方
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Batting Average");

    // 添加 Y 軸標籤
    scatter2Svg.append("text")
        .attr("x", -150) // 旋轉後的位置調整
        .attr("y", 20) // 距離 Y 軸的水平偏移
        .attr("transform", "rotate(-90)") // 垂直顯示
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Hard Hit Rate (%)");
}


function drawPie(containerId, leagueData, year) {
    const pieSvg = d3.select(containerId);
    pieSvg.selectAll("*").remove();

    // 篩選指定年份的資料
    const filteredData = leagueData.filter(d => d.year === year);

    // 累加所有相關比例數據
    const pieData = filteredData.reduce((acc, d) => {
        acc.fly_ball += d.fly_ball_pct || 0; // 確保數據存在
        acc.ground_ball += d.ground_ball_pct || 0;
        acc.line_drive += d.line_drive_pct || 0;
        acc.popup += d.popup_pct || 0;
        return acc;
    }, { fly_ball: 0, ground_ball: 0, line_drive: 0, popup: 0 });

    // 將累計數據轉換為比例
    const total = Object.values(pieData).reduce((sum, val) => sum + val, 0);
    const normalizedPieData = Object.entries(pieData).map(([key, value]) => [key, (value / total) * 100]);

    const pie = d3.pie().value(d => d[1])(normalizedPieData);
    const arc = d3.arc().innerRadius(0).outerRadius(100);

    const color = d3.scaleOrdinal()
        .domain(["fly_ball", "ground_ball", "line_drive", "popup"])
        .range(["#ffcc00", "#66ccff", "#ff6666", "#99cc00"]);

    // 畫餅圖
    const g = pieSvg.append("g")
        .attr("transform", "translate(200, 150)");

    g.selectAll("path")
        .data(pie)
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data[0]));

    // 添加文字標籤
    g.selectAll("text")
        .data(pie)
        .enter()
        .append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .text(d => `${d.data[0]}: ${d.data[1].toFixed(1)}%`)
        .style("font-size", "14px")
        .style("text-anchor", "middle");
}


function updateYearlyCharts(filteredTeams, selectedYears, leagueData) {
    const chartContainer = d3.select("#charts");
    chartContainer.selectAll("*").remove(); // 清空舊的圖表

    // 按年份分組數據
    selectedYears.forEach(year => {
        const teamData = filteredTeams.filter(d => d.year === year);

        // 創建年份容器，設置垂直排列
        const yearDiv = chartContainer.append("div")
            .attr("class", "year-chart")
            .style("margin-bottom", "30px"); // 調整各年份的間距

        // 添加年份標題
        yearDiv.append("h3")
            .text(`Year: ${year}`)
            .style("text-align", "center") // 居中對齊
            .style("width", "100%");      // 確保標題占據整個寬度

        // 創建 3 個 SVG 容器，垂直排列
        const scatter1Svg = yearDiv.append("svg")
            .attr("width", 500)
            .attr("height", 300)
            .attr("id", `scatter1-${year}`);

        const scatter2Svg = yearDiv.append("svg")
            .attr("width", 500)
            .attr("height", 300)
            .attr("id", `scatter2-${year}`);

        const pieSvg = yearDiv.append("svg")
            .attr("width", 400)
            .attr("height", 400)
            .attr("id", `pie-${year}`);

        // 繪製圖表
        drawScatter1(`#scatter1-${year}`, teamData);
        drawScatter2(`#scatter2-${year}`, teamData);
        drawPie(`#pie-${year}`, leagueData, year);
    });
}



// part2 betts view
d3.csv("betts_stats.csv").then(data => {
    const bettsData = data.map(d => ({
        year: +d.Year,
        angle: +d.Angle,
        hardHit: +d.Hardhit,   
        wRC: +d.wRC
    }));

    // console.log("Parsed Betts Data:", bettsData);
    drawBettsView("#betts-view", bettsData);
});


function drawBettsView(containerId, data) {
    const width = 600, height = 500, radius = Math.min(width, height) / 2;

    // 清空容器
    const container = d3.select(containerId);
    container.style("position", "relative").selectAll("*").remove();
    
    // 表格區域 - 放置在 Betts View 的右側
    const tableContainer = container.append("div")
        .attr("id", "betts-table")
        .style("position", "absolute")
        .style("left", `${width + 20}px`) // 緊鄰 SVG 右側
        .style("top", "0px") // 與頂部對齊
        .style("font-size", "14px")
        .style("line-height", "1.5")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("background-color", "#f9f9f9")
        .style("display", "none")
        .style("width", "150px"); // 修改成您想要的寬度


    tableContainer.html(`
        <h3 style="text-align: center; margin-bottom: 10px;">Mookie Betts Stats</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><th style="text-align: left;">Year </th><td id="year-val"></td></tr>
            <tr><th style="text-align: left;">Angle </th><td id="angle-val"></td></tr>
            <tr><th style="text-align: left;">Hard Hit </th><td id="hardhit-val"></td></tr>
            <tr><th style="text-align: left;">wRC+ </th><td id="wrc-val"></td></tr>
        </table>
    `);

    // 添加圖片並確保右側貼齊圓心點
    const image = container.append("img")
        .attr("src", "betts_dodger.jpg") // 預設圖片
        .attr("width", 250)
        .style("position", "absolute")
        .style("left", `${width / 2 - 250}px`) // 圖片左側偏移
        .style("top", `${height / 2 - 140}px`);

    // 添加描述文字
    const description = container.append("div")
        .attr("class", "image-description")
        .style("position", "absolute")
        .style("left", `${width / 2 - 250}px`) // 左側對齊圖片
        .style("top", `${height / 2 + 190}px`) // 位於圖片下方
        .style("width", "250px")
        .style("text-align", "center")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("2020-2024 in Dodgers");

    // 添加 SVG 畫布
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Scales: 0° = 3 點鐘方向，逆時針計算
    const angleScale = d3.scaleLinear()
        .domain([0, 90])
        .range([0, Math.PI / 2]); // 0 到 90 度的範圍

    const radiusScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.hardHit)])
        .range([0, radius]);

    // 輔助線 (右半圓)
    const radiusTicks = [10, 20, 30, 40, 50];
    radiusTicks.forEach(tick => {
        svg.append("path")
            .attr("d", d3.arc()
                .innerRadius(radiusScale(tick))
                .outerRadius(radiusScale(tick))
                .startAngle(0)
                .endAngle(Math.PI / 2)
            )
            .attr("fill", "none")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1);
    });

    // 角度標籤
    const angleTicks = [0, 30, 60, 90];
    svg.selectAll(".angle-label")
        .data(angleTicks)
        .enter()
        .append("text")
        .attr("x", d => radius * Math.cos(-angleScale(d)))
        .attr("y", d => radius * Math.sin(-angleScale(d)))
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text(d => `${d}°`);

    // 繪製柱狀條 (Bars)
    const bars = svg.selectAll(".bar")
        .data(data)
        .enter()
        .append("path")
        .attr("class", "bar")
        .attr("d", d3.arc()
            .innerRadius(0)
            .outerRadius(d => radiusScale(d.hardHit))
            .startAngle(d => -angleScale(d.angle - 90) - Math.PI / 270)
            .endAngle(d => -angleScale(d.angle - 90) + Math.PI / 270)
        )
        .attr("fill", d => d.year < 2020 ? "red" : "blue")
        .attr("opacity", 0.8)
        .on("mouseover", (event, d) => {
            // 高亮當前 Bar，其餘變透明
            bars.attr("opacity", 0.2);
            d3.select(event.currentTarget).attr("opacity", 1).attr("stroke", "black").attr("stroke-width", 1.5);

            // 顯示表格並更新數據
            tableContainer.style("display", "block");
            tableContainer.select("#year-val").text(d.year);
            tableContainer.select("#angle-val").text(`${d.angle}°`);
            tableContainer.select("#hardhit-val").text(`${d.hardHit}%`);
            tableContainer.select("#wrc-val").text(d.wRC);

            // 更換圖片與文字
            const imageSrc = d.year < 2020 ? "betts_redsox.jpg" : "betts_dodger.jpg";
            const text = d.year < 2020 ? "2014-2019 in Red Sox" : "2020-2024 in Dodgers";

            image.attr("src", imageSrc);
            description.text(text);
        })
        .on("mouseout", () => {
            // 恢復所有 Bar 的透明度
            bars.attr("opacity", 0.8).attr("stroke", "none");
            tableContainer.style("display", "none"); // 隱藏表格
        });
}
