"""
农历生日转换器 - Flask API 后端
功能：根据身份证上的公历出生日期，计算往后每年农历生日对应的公历日期
"""

from datetime import datetime, date
from lunardate import LunarDate
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='.')
CORS(app)

# 农历月份中文名
LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']

# 农历日期中文名
LUNAR_DAYS = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]


def get_lunar_month_name(month, is_leap=False):
    """获取农历月份名称"""
    prefix = "闰" if is_leap else ""
    return f"{prefix}{LUNAR_MONTHS[month - 1]}月"


def get_lunar_day_name(day):
    """获取农历日期名称"""
    return LUNAR_DAYS[day - 1]


def solar_to_lunar(year, month, day):
    """公历转农历"""
    try:
        lunar = LunarDate.fromSolarDate(year, month, day)
        return {
            'year': lunar.year,
            'month': lunar.month,
            'day': lunar.day,
            'is_leap': lunar.isLeapMonth,
            'month_name': get_lunar_month_name(lunar.month, lunar.isLeapMonth),
            'day_name': get_lunar_day_name(lunar.day),
            'cn_str': f"农历{lunar.year}年{get_lunar_month_name(lunar.month, lunar.isLeapMonth)}{get_lunar_day_name(lunar.day)}"
        }
    except ValueError as e:
        return None


def lunar_to_solar(year, month, day, is_leap=False):
    """农历转公历"""
    try:
        lunar = LunarDate(year, month, day, isLeapMonth=is_leap)
        solar = lunar.toSolarDate()
        return {
            'year': solar.year,
            'month': solar.month,
            'day': solar.day,
            'date_str': solar.strftime('%Y年%m月%d日'),
            'weekday': ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][solar.weekday()]
        }
    except ValueError as e:
        return None


def get_lunar_birthdays(birth_year, birth_month, birth_day, years_count=100, include_leap=True):
    """
    获取未来若干年的农历生日对应的公历日期

    Args:
        birth_year: 出生年份（公历）
        birth_month: 出生月份（公历）
        birth_day: 出生日期（公历）
        years_count: 要计算的年数
        include_leap: 是否包含闰月生日

    Returns:
        包含转换结果的列表
    """
    results = []

    # 首先获取出生日期对应的农历日期
    birth_lunar = solar_to_lunar(birth_year, birth_month, birth_day)
    if not birth_lunar:
        return {'error': '无法转换出生日期，请检查日期是否有效'}

    lunar_month = birth_lunar['month']
    lunar_day = birth_lunar['day']
    birth_is_leap = birth_lunar['is_leap']

    # 计算从出生年开始往后 years_count 年的农历生日
    current_year = datetime.now().year

    for year_offset in range(years_count + 1):
        lunar_year = birth_lunar['year'] + year_offset
        age = year_offset  # 虚岁要 +1

        # 尝试获取该年农历生日对应的公历日期
        solar_date = lunar_to_solar(lunar_year, lunar_month, lunar_day, is_leap=False)

        if solar_date:
            result = {
                'lunar_year': lunar_year,
                'lunar_date': f"{get_lunar_month_name(lunar_month)}{get_lunar_day_name(lunar_day)}",
                'solar_date': solar_date['date_str'],
                'solar_year': solar_date['year'],
                'solar_month': solar_date['month'],
                'solar_day': solar_date['day'],
                'weekday': solar_date['weekday'],
                'age': age,
                'age_xu': age + 1,  # 虚岁
                'is_leap_birthday': False,
                'is_past': solar_date['year'] < current_year or
                          (solar_date['year'] == current_year and
                           date(solar_date['year'], solar_date['month'], solar_date['day']) < date.today())
            }
            results.append(result)

        # 如果设置包含闰月且该年有闰月生日
        if include_leap:
            leap_solar = lunar_to_solar(lunar_year, lunar_month, lunar_day, is_leap=True)
            if leap_solar:
                result = {
                    'lunar_year': lunar_year,
                    'lunar_date': f"闰{get_lunar_month_name(lunar_month)}{get_lunar_day_name(lunar_day)}",
                    'solar_date': leap_solar['date_str'],
                    'solar_year': leap_solar['year'],
                    'solar_month': leap_solar['month'],
                    'solar_day': leap_solar['day'],
                    'weekday': leap_solar['weekday'],
                    'age': age,
                    'age_xu': age + 1,
                    'is_leap_birthday': True,
                    'is_past': leap_solar['year'] < current_year or
                              (leap_solar['year'] == current_year and
                               date(leap_solar['year'], leap_solar['month'], leap_solar['day']) < date.today())
                }
                results.append(result)

    # 按公历日期排序
    results.sort(key=lambda x: (x['solar_year'], x['solar_month'], x['solar_day']))

    return {
        'birth_solar': f"{birth_year}年{birth_month:02d}月{birth_day:02d}日",
        'birth_lunar': birth_lunar['cn_str'],
        'lunar_month': lunar_month,
        'lunar_day': lunar_day,
        'lunar_month_name': get_lunar_month_name(lunar_month, birth_is_leap),
        'lunar_day_name': get_lunar_day_name(lunar_day),
        'is_birth_leap': birth_is_leap,
        'results': results
    }


@app.route('/')
def index():
    """返回前端页面"""
    return send_from_directory('.', 'index.html')


@app.route('/app.js')
def serve_js():
    """返回JavaScript文件"""
    return send_from_directory('.', 'app.js')


@app.route('/api/convert', methods=['POST'])
def convert_birthday():
    """API接口：转换生日"""
    try:
        data = request.get_json()

        birth_date = data.get('birth_date')  # 格式: YYYY-MM-DD
        years_count = data.get('years_count', 100)
        include_leap = data.get('include_leap', True)

        if not birth_date:
            return jsonify({'error': '请提供出生日期'}), 400

        # 解析日期
        parts = birth_date.split('-')
        if len(parts) != 3:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD 格式'}), 400

        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])

        # 验证日期范围（lunardate 支持 1900-2100）
        if year < 1900 or year > 2099:
            return jsonify({'error': '年份超出范围，请输入1900-2099之间的年份'}), 400

        result = get_lunar_birthdays(year, month, day, years_count, include_leap)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': f'转换失败: {str(e)}'}), 500


@app.route('/api/test', methods=['GET'])
def test():
    """测试API"""
    return jsonify({'status': 'ok', 'message': '农历生日转换器API正常运行'})


if __name__ == '__main__':
    print("=" * 50)
    print("农历生日转换器已启动")
    print("请访问: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)