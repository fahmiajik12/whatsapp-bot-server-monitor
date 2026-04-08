const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');

const width = 800;
const height = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height, 
    backgroundColour: '#121212'
});

/**
 * Generate a status chart from history data
 * @param {Object} history { cpu: [], ram: [], disk: [] }
 * @param {String} outputPath Path to save the PNG
 */
async function generateStatusChart(history, outputPath) {
    const labels = history.cpu.map((_, i) => ""); 
    const lastCPU = history.cpu.length > 0 ? history.cpu[history.cpu.length - 1].toFixed(1) : '-';
    const lastRAM = history.ram.length > 0 ? history.ram[history.ram.length - 1].toFixed(1) : '-';
    const lastDisk = history.disk.length > 0 ? history.disk[history.disk.length - 1].toFixed(1) : '-';

    const statusBoxPlugin = {
        id: 'statusBox',
        afterDraw: (chart) => {
            const { ctx, chartArea: { top, right, width, height } } = chart;
            const boxWidth = 160;
            const boxHeight = 85;
            const padding = 10;
            const x = right - boxWidth - 10;
            const y = top + 10;

            ctx.save();
            ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            
            const r = 8;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + boxWidth - r, y);
            ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + r);
            ctx.lineTo(x + boxWidth, y + boxHeight - r);
            ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - r, y + boxHeight);
            ctx.lineTo(x + r, y + boxHeight);
            ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('LATEST STATUS', x + 10, y + 20);

            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(255, 99, 132, 1)';
            ctx.fillText(`CPU: ${lastCPU}%`, x + 10, y + 40);
            
            ctx.fillStyle = 'rgba(54, 162, 235, 1)';
            ctx.fillText(`RAM: ${lastRAM}%`, x + 10, y + 55);
            
            ctx.fillStyle = 'rgba(75, 192, 192, 1)';
            ctx.fillText(`Disk: ${lastDisk}%`, x + 10, y + 70);
            
            ctx.restore();
        }
    };

    const configuration = {
        type: 'line',
        plugins: [statusBoxPlugin],
        data: {
            labels: labels,
            datasets: [
                {
                    label: `CPU`,
                    data: history.cpu,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: `RAM`,
                    data: history.ram,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: `Disk`,
                    data: history.disk,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#ffffff' }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#ffffff', font: { size: 14 } }
                },
                title: {
                    display: true,
                    text: 'Server Resource Trend (Last 24h)',
                    color: '#ffffff',
                    font: { size: 18, weight: 'bold' }
                }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync(outputPath, image);
    return outputPath;
}

module.exports = { generateStatusChart };
