/**
 * RACEBOX ANALYTICS CENTER — DATA ENGINE & ECHARTS
 * Motor Performance, Telemetry, and Drag Benchmark Visualization
 */

(function () {
  'use strict';

  function initChart(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    return echarts.init(el);
  }

  // Server Clock
  function updateClock() {
    var clockEl = document.getElementById('rbLiveClock');
    if (!clockEl) return;
    var now = new Date();
    var yr = now.getFullYear();
    var mo = String(now.getMonth() + 1).padStart(2, '0');
    var dt = String(now.getDate()).padStart(2, '0');
    var hr = String(now.getHours()).padStart(2, '0');
    var mi = String(now.getMinutes()).padStart(2, '0');
    var sc = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = yr + '-' + mo + '-' + dt + ' ' + hr + ':' + mi + ':' + sc;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Color constants (Racebox Maroon System)
  var COLOR_PRIMARY = '#E10600';
  var COLOR_PRIMARY_LIGHT = '#FF2E24';
  var COLOR_SILVER = '#B8B8B8';
  var COLOR_CHROME = '#F2F2F2';
  var COLOR_BORDER = '#232327';

  // Tooltip theme
  var tooltipTheme = {
    backgroundColor: '#111113',
    borderColor: '#3A3A40',
    borderWidth: 1,
    textStyle: { color: '#F2F2F2', fontFamily: 'Inter, sans-serif', fontSize: 12 },
    className: 'rb-echarts-tooltip'
  };

  // 1. Speed Profile Chart
  var chartSpeed = initChart('chartSpeedProfile');
  function renderSpeedChart(races) {
    if (!chartSpeed) return;
    var dates = [];
    var speeds = [];

    if (races && races.length > 0) {
      races.forEach(function (r, i) {
        var d = new Date(r.created_at);
        var label = (d.getMonth() + 1) + '/' + d.getDate() + ' #' + (i + 1);
        dates.push(label);
        speeds.push(r.max_speed_kmh ? Number(r.max_speed_kmh) : 0);
      });
    }

    if (dates.length === 0) {
      chartSpeed.setOption({
        backgroundColor: 'transparent',
        title: {
          text: 'Belum Ada Data Sesi Pengujian',
          subtext: 'Lakukan run pengujian pada aplikasi RaceBox untuk mencatat kurva kecepatan',
          left: 'center',
          top: 'center',
          textStyle: { color: '#7C7C84', fontSize: 14, fontWeight: 600 },
          subtextStyle: { color: '#5A5A62', fontSize: 12 }
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      });
      return;
    }

    chartSpeed.setOption({
      title: { show: false },
      backgroundColor: 'transparent',
      tooltip: Object.assign({}, tooltipTheme, {
        trigger: 'axis',
        formatter: function (params) {
          var p = params[0];
          var idx = p.dataIndex;
          var item = races[idx];
          return '<div style="font-weight:700;margin-bottom:4px;color:#fff;">' + (item.vehicle_name || 'Motor') + '</div>' +
                 '<div style="color:#B8B8B8;font-size:11px;">Rider: ' + item.user_name + ' | Test: ' + item.test_type + '</div>' +
                 '<div style="margin-top:6px;color:#FF2E24;font-size:14px;font-weight:800;">Top Speed: ' + p.value + ' km/h</div>';
        }
      }),
      grid: { top: 25, bottom: 30, left: 45, right: 25 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#232327' } },
        axisLabel: { color: '#7C7C84', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: 'km/h',
        nameTextStyle: { color: '#7C7C84', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1B1B1F', type: 'dashed' } },
        axisLabel: { color: '#7C7C84', fontSize: 11 }
      },
      series: [
        {
          name: 'Top Speed',
          type: 'line',
          smooth: 0.35,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: { color: COLOR_PRIMARY, borderColor: '#fff', borderWidth: 1 },
          lineStyle: { color: COLOR_PRIMARY, width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(225, 6, 0, 0.45)' },
              { offset: 1, color: 'rgba(225, 6, 0, 0.02)' }
            ])
          },
          data: speeds
        }
      ]
    });
  }

  // 2. Drag & Acceleration Benchmarks Bar Chart
  var chartBenchmarks = initChart('chartBenchmarks');
  function renderBenchmarks(races) {
    if (!chartBenchmarks) return;

    var best060 = null;
    var best0100 = null;
    var best201 = null;
    var best402 = null;

    if (races && races.length > 0) {
      races.forEach(function (r) {
        if (r.time_0_60_ms && r.time_0_60_ms > 0) {
          var s = Number(r.time_0_60_ms) / 1000;
          if (best060 === null || s < best060) best060 = s;
        }
        if (r.time_0_100_ms && r.time_0_100_ms > 0) {
          var s = Number(r.time_0_100_ms) / 1000;
          if (best0100 === null || s < best0100) best0100 = s;
        }
        if (r.time_201m_ms && r.time_201m_ms > 0) {
          var s = Number(r.time_201m_ms) / 1000;
          if (best201 === null || s < best201) best201 = s;
        }
        if (r.time_402m_ms && r.time_402m_ms > 0) {
          var s = Number(r.time_402m_ms) / 1000;
          if (best402 === null || s < best402) best402 = s;
        }
      });
    }

    if (best060 === null && best0100 === null && best201 === null && best402 === null) {
      chartBenchmarks.setOption({
        backgroundColor: 'transparent',
        title: {
          text: 'Belum Ada Rekor Waktu Tempuh',
          subtext: 'Waktu 0-60, 0-100, 201m, dan 402m akan dihitung otomatis saat tes dilakukan',
          left: 'center',
          top: 'center',
          textStyle: { color: '#7C7C84', fontSize: 13, fontWeight: 600 },
          subtextStyle: { color: '#5A5A62', fontSize: 11 }
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      });
      return;
    }

    chartBenchmarks.setOption({
      title: { show: false },
      backgroundColor: 'transparent',
      tooltip: Object.assign({}, tooltipTheme, {
        trigger: 'axis',
        formatter: '{b}: <b style="color:#FF2E24">{c} s</b>'
      }),
      grid: { top: 25, bottom: 25, left: 45, right: 20 },
      xAxis: {
        type: 'category',
        data: ['0-60 km/h', '0-100 km/h', '201 m (1/8)', '402 m (1/4)'],
        axisLine: { lineStyle: { color: '#232327' } },
        axisLabel: { color: '#7C7C84', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: 'detik',
        nameTextStyle: { color: '#7C7C84', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1B1B1F', type: 'dashed' } },
        axisLabel: { color: '#7C7C84', fontSize: 11 }
      },
      series: [
        {
          name: 'Waktu Terbaik',
          type: 'bar',
          barWidth: 26,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: COLOR_PRIMARY_LIGHT },
              { offset: 1, color: COLOR_PRIMARY }
            ])
          },
          label: {
            show: true,
            position: 'top',
            color: '#F2F2F2',
            fontSize: 11,
            fontWeight: 700,
            formatter: '{c}s'
          },
          data: [
            best060 ? Number(best060.toFixed(2)) : 0,
            best0100 ? Number(best0100.toFixed(2)) : 0,
            best201 ? Number(best201.toFixed(2)) : 0,
            best402 ? Number(best402.toFixed(2)) : 0
          ]
        }
      ]
    });
  }

  // 3. Test Type Distribution Donut Chart
  var chartDist = initChart('chartDistDonut');
  function renderDistribution(distData) {
    if (!chartDist) return;

    if (!distData || distData.length === 0) {
      chartDist.setOption({
        backgroundColor: 'transparent',
        title: {
          text: 'Belum Ada Distribusi Tes',
          subtext: 'Grafik proporsi kategori tes akan tampil di sini',
          left: 'center',
          top: 'center',
          textStyle: { color: '#7C7C84', fontSize: 13, fontWeight: 600 },
          subtextStyle: { color: '#5A5A62', fontSize: 11 }
        },
        series: []
      });
      return;
    }

    var colors = ['#E10600', '#B30000', '#7A0500', '#F2F2F2', '#B8B8B8'];
    var formatted = distData.map(function (d, i) {
      return {
        value: Number(d.count),
        name: d.test_type,
        itemStyle: { color: colors[i % colors.length] }
      };
    });

    chartDist.setOption({
      title: { show: false },
      backgroundColor: 'transparent',
      tooltip: Object.assign({}, tooltipTheme, {
        trigger: 'item',
        formatter: '{b}: <b style="color:#FF2E24">{c} sesi</b> ({d}%)'
      }),
      series: [
        {
          name: 'Tipe Tes',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#111113',
            borderWidth: 2
          },
          label: {
            show: true,
            color: '#B8B8B8',
            fontSize: 11,
            formatter: '{b}'
          },
          labelLine: {
            lineStyle: { color: '#3A3A40' }
          },
          data: formatted
        }
      ]
    });
  }

  // Initial render using preloaded server data if available
  if (window.__INITIAL_RACES__) {
    renderSpeedChart(window.__INITIAL_RACES__);
    renderBenchmarks(window.__INITIAL_RACES__);
  }
  if (window.__INITIAL_DIST__) {
    renderDistribution(window.__INITIAL_DIST__);
  }

  // Handle Dynamic Filtering
  var selectVehicle = document.getElementById('filterVehicle');
  var selectType = document.getElementById('filterTestType');
  var selectRange = document.getElementById('filterRange');

  function applyFilters() {
    var vId = selectVehicle ? selectVehicle.value : 'all';
    var tType = selectType ? selectType.value : 'all';
    var range = selectRange ? selectRange.value : 'all';

    var url = '/admin/api/analytics?vehicleId=' + encodeURIComponent(vId) +
              '&testType=' + encodeURIComponent(tType) +
              '&range=' + encodeURIComponent(range);

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success) return;

        // Update stat values
        var countEl = document.getElementById('statRacesCount');
        var speedEl = document.getElementById('statTopSpeed');
        var best201El = document.getElementById('statBest201m');
        var best402El = document.getElementById('statBest402m');

        if (countEl) countEl.textContent = data.metrics.totalRaces;
        if (speedEl) speedEl.textContent = data.metrics.maxSpeed ? data.metrics.maxSpeed + ' km/h' : '-';
        if (best201El) best201El.textContent = data.metrics.best201m ? data.metrics.best201m + ' s' : '-';
        if (best402El) best402El.textContent = data.metrics.best402m ? data.metrics.best402m + ' s' : '-';

        // Re-render charts
        renderSpeedChart(data.races);
        renderBenchmarks(data.races);

        // Update table rows
        updateTableRows(data.races);
      })
      .catch(function (err) {
        console.warn('Analytics filter fetch error:', err);
      });
  }

  function updateTableRows(races) {
    var tbody = document.getElementById('latestRacesTableBody');
    if (!tbody) return;

    if (!races || races.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="rb-empty-state"><div class="rb-empty-icon">🏁</div><div class="rb-empty-title">Tidak Ada Sesi Pengujian Sesuai Filter</div><div class="rb-empty-desc">Coba sesuaikan filter kendaraan atau tipe pengujian untuk melihat hasil lainnya.</div></td></tr>';
      return;
    }

    var html = '';
    races.slice(0, 15).forEach(function (r) {
      var d = new Date(r.created_at);
      var dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      var speedStr = r.max_speed_kmh ? Number(r.max_speed_kmh).toFixed(1) + ' km/h' : '-';
      var time201 = r.time_201m_ms ? (Number(r.time_201m_ms) / 1000).toFixed(3) + ' s' : '-';

      html += '<tr>' +
              '<td>' + dateStr + '</td>' +
              '<td><strong>' + (r.vehicle_name || '-') + '</strong></td>' +
              '<td>' + (r.user_name || '-') + '</td>' +
              '<td><span class="badge badge-red">' + r.test_type + '</span></td>' +
              '<td><strong style="color:#FF2E24;">' + speedStr + '</strong></td>' +
              '<td>' + time201 + '</td>' +
              '<td><a class="btn btn-secondary btn-sm" href="/admin/races/' + r.id + '">Detail Telemetri</a></td>' +
              '</tr>';
    });
    tbody.innerHTML = html;
  }

  if (selectVehicle) selectVehicle.addEventListener('change', applyFilters);
  if (selectType) selectType.addEventListener('change', applyFilters);
  if (selectRange) selectRange.addEventListener('change', applyFilters);

  // Responsive resize
  window.addEventListener('resize', function () {
    if (chartSpeed) chartSpeed.resize();
    if (chartBenchmarks) chartBenchmarks.resize();
    if (chartDist) chartDist.resize();
  });

})();
