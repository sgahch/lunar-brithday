// 农历生日转换器 - 前端逻辑
let allResults = [];
let birthInfo = null;  // 保存出生信息用于导出

async function convertBirthday() {
    const birthDate = document.getElementById('birthDate').value;
    const yearsCount = document.getElementById('yearsCount').value;
    const includeLeap = document.getElementById('includeLeap').checked;
    
    if (!birthDate) {
        alert('请选择出生日期');
        return;
    }
    
    const btn = document.querySelector('.btn');
    const resultSection = document.getElementById('resultSection');
    const resultTable = document.getElementById('resultTable');
    
    btn.disabled = true;
    btn.textContent = '转换中...';
    resultTable.innerHTML = '<tr><td colspan="6" class="loading">⏳ 正在计算，请稍候...</td></tr>';
    resultSection.style.display = 'block';
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                birth_date: birthDate,
                years_count: parseInt(yearsCount),
                include_leap: includeLeap
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            resultTable.innerHTML = `<tr><td colspan="6" class="error">❌ ${data.error}</td></tr>`;
            return;
        }
        
        // 保存出生信息
        birthInfo = {
            solar: data.birth_solar,
            lunar: data.birth_lunar,
            lunarMonthName: data.lunar_month_name,
            lunarDayName: data.lunar_day_name
        };

        // 显示出生日期信息
        document.getElementById('birthInfo').innerHTML = `
            <h3>您的出生信息</h3>
            <p>公历：<strong>${data.birth_solar}</strong></p>
            <p class="lunar-date">农历：${data.birth_lunar}</p>
            <p style="margin-top:10px;color:#666;">每年农历 <strong>${data.lunar_month_name}${data.lunar_day_name}</strong> 就是您的农历生日</p>
        `;

        allResults = data.results;

        // 显示导出按钮
        document.getElementById('exportBtn').style.display = 'inline-block';
        renderResults(allResults);
        
        // 设置跳转年份的范围
        if (allResults.length > 0) {
            const jumpInput = document.getElementById('jumpYear');
            jumpInput.min = allResults[0].solar_year;
            jumpInput.max = allResults[allResults.length - 1].solar_year;
            jumpInput.value = new Date().getFullYear();
        }
        
    } catch (error) {
        resultTable.innerHTML = `<tr><td colspan="6" class="error">❌ 网络错误：${error.message}</td></tr>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 开始转换';
    }
}

function renderResults(results) {
    const resultTable = document.getElementById('resultTable');
    const currentYear = new Date().getFullYear();
    
    if (results.length === 0) {
        resultTable.innerHTML = '<tr><td colspan="6" class="empty-state">没有找到符合条件的结果</td></tr>';
        return;
    }
    
    let html = '';
    results.forEach(item => {
        let rowClass = '';
        let statusTag = '';
        
        if (item.is_past) {
            rowClass = 'past';
            statusTag = '<span class="tag tag-past">已过</span>';
        } else if (item.solar_year === currentYear) {
            rowClass = 'current';
            statusTag = '<span class="tag tag-upcoming">今年</span>';
        } else {
            statusTag = '<span class="tag tag-upcoming">未来</span>';
        }
        
        if (item.is_leap_birthday) {
            rowClass += ' leap';
            statusTag += '<span class="tag tag-leap">闰月</span>';
        }
        
        html += `
            <tr class="${rowClass}" data-year="${item.solar_year}">
                <td>${item.solar_date}</td>
                <td>${item.weekday}</td>
                <td>${item.lunar_date}</td>
                <td>${item.age}</td>
                <td>${item.age_xu}</td>
                <td>${statusTag}</td>
            </tr>
        `;
    });
    
    resultTable.innerHTML = html;
    
    // 自动滚动到今年
    setTimeout(() => {
        const currentRow = document.querySelector('tr.current');
        if (currentRow) {
            currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function filterResults() {
    const filterType = document.getElementById('filterType').value;
    let filtered = allResults;
    
    if (filterType === 'future') {
        filtered = allResults.filter(item => !item.is_past);
    } else if (filterType === 'past') {
        filtered = allResults.filter(item => item.is_past);
    }
    
    renderResults(filtered);
}

function jumpToYear() {
    const year = parseInt(document.getElementById('jumpYear').value);
    if (!year) return;
    
    const row = document.querySelector(`tr[data-year="${year}"]`);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.background = '#fff3cd';
        setTimeout(() => { row.style.background = ''; }, 2000);
    } else {
        alert(`未找到 ${year} 年的记录`);
    }
}

// 导出为 Markdown 文件
function exportToMarkdown() {
    if (!birthInfo || allResults.length === 0) {
        alert('请先转换生日数据');
        return;
    }

    const currentYear = new Date().getFullYear();
    const filterType = document.getElementById('filterType').value;

    // 根据筛选条件过滤数据
    let dataToExport = allResults;
    let filterLabel = '全部';
    if (filterType === 'future') {
        dataToExport = allResults.filter(item => !item.is_past);
        filterLabel = '未来';
    } else if (filterType === 'past') {
        dataToExport = allResults.filter(item => item.is_past);
        filterLabel = '已过';
    }

    // 统计信息
    const leapCount = dataToExport.filter(item => item.is_leap_birthday).length;
    const pastCount = dataToExport.filter(item => item.is_past).length;
    const futureCount = dataToExport.filter(item => !item.is_past).length;
    const yearRange = dataToExport.length > 0
        ? `${dataToExport[0].solar_year} - ${dataToExport[dataToExport.length - 1].solar_year}`
        : '-';

    // 生成 Markdown 内容
    let md = `# 🎂 农历生日日历\n\n`;
    md += `<p align="center"><em>自动生成的农历生日对照表，再也不用担心错过农历生日啦！</em></p>\n\n`;
    md += `---\n\n`;

    md += `## 📋 基本信息\n\n`;
    md += `| 项目 | 内容 |\n`;
    md += `| :--- | :--- |\n`;
    md += `| 🗓️ 公历生日 | **${birthInfo.solar}** |\n`;
    md += `| 🌙 农历生日 | **${birthInfo.lunar}** |\n`;
    md += `| 🎯 每年农历 | **${birthInfo.lunarMonthName}${birthInfo.lunarDayName}** |\n`;
    md += `| 📅 年份范围 | ${yearRange} |\n`;
    md += `| 🕐 生成时间 | ${new Date().toLocaleString('zh-CN')} |\n\n`;

    md += `## 📊 数据统计\n\n`;
    md += `| 统计项 | 数量 |\n`;
    md += `| :--- | :---: |\n`;
    md += `| 📝 总记录数 | **${dataToExport.length}** 条 |\n`;
    md += `| ✅ 已过生日 | ${pastCount} 次 |\n`;
    md += `| ⏳ 未来生日 | ${futureCount} 次 |\n`;
    md += `| 🌸 闰月生日 | ${leapCount} 次 |\n`;
    md += `| 🔍 当前筛选 | ${filterLabel} |\n\n`;

    md += `---\n\n`;
    md += `## 📆 农历生日对应公历日期表\n\n`;
    md += `| 公历日期 | 星期 | 农历日期 | 周岁 | 虚岁 | 状态 |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: | :---: |\n`;

    dataToExport.forEach(item => {
        let status = '';
        if (item.is_past) {
            status = '⬜ 已过';
        } else if (item.solar_year === currentYear) {
            status = '⭐ **今年**';
        } else {
            status = '🔮 未来';
        }
        if (item.is_leap_birthday) {
            status += ' 🌸';
        }

        md += `| ${item.solar_date} | ${item.weekday} | ${item.lunar_date} | ${item.age} | ${item.age_xu} | ${status} |\n`;
    });

    md += `\n---\n\n`;
    md += `## 💡 说明\n\n`;
    md += `- ⭐ 表示今年的生日\n`;
    md += `- 🌸 表示该年为闰月生日\n`;
    md += `- 周岁：过了公历生日当天才算满一岁\n`;
    md += `- 虚岁：出生即为一岁，每过一个春节加一岁\n\n`;
    md += `---\n\n`;
    md += `<p align="center">\n`;
    md += `  <em>由 <a href="https://github.com/YaenChen/lunar-birthday-converter">农历生日转换器</a> 生成</em><br>\n`;
    md += `  <sub>🎉 记得提前准备生日礼物哦～</sub>\n`;
    md += `</p>\n`;

    // 创建并下载文件
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `农历生日_${birthInfo.solar.replace(/年|月|日/g, '-').slice(0, -1)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 页面加载时设置默认日期为一个示例
document.addEventListener('DOMContentLoaded', () => {
    // 设置日期输入范围
    const birthInput = document.getElementById('birthDate');
    birthInput.min = '1900-01-01';
    birthInput.max = '2099-12-31';
});
