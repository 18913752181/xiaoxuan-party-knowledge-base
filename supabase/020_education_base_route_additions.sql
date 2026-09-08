-- 《红色教育基地路线.xlsx》中缺少的 5 个基地。
-- ID 1“沙家浜革命历史纪念馆”已存在，不重复写入。
-- 仅写入已核实字段；未确认的坐标、讲解费等保持空值。

insert into public.education_bases (
  id, name, type, city, district, intro, status, icon, contact, source_url,
  address, latitude, longitude, coordinate_type, location_source_name,
  location_source_url, location_confidence, sort_order, is_published,
  has_guided_tour, guide_fee, guide_service_note, guide_source_url, guide_verified_at,
  opening_info, reservation_info, activity_route
) values
  (
    150, '中共淞沪中心县委纪念馆', '红色资源', '苏州市', '昆山市',
    '位于张浦镇石人潭公园，设浴血而生、敌后斗争、转战浙东、星火传承四个主题展区，展示昆南淀山湖地区抗日斗争历史。',
    '可联系', '⌖', '预约咨询：0512-57229110',
    'https://www.ks.gov.cn/kss/qzkx/202607/f66d56b11e4a4fca85fdec6d612546e9.shtml',
    '苏州市昆山市张浦镇桃源路石人潭公园', null, null, null,
    '昆山市张浦镇人民政府',
    'https://www.ksrmtzx.com/news/detail/168839', 'pending', 150, true,
    null, null, null, null, null,
    '公开资料显示周一至周五9:00—16:30；出行前请向场馆复核。',
    '预约咨询电话0512-57229110。',
    '四大主题展区→石人潭公园纪念碑区域。'
  ),
  (
    151, '双山岛渡江胜利公园', '红色资源', '苏州市', '张家港市',
    '以双山渡江战役纪念碑区域为核心，包含纪念广场、胜利之路展示区、渡江战役展示馆等教育空间。',
    '可联系', '⌖', '轮渡班次及团队接待请提前向双山香山旅游度假区确认',
    'https://www.suzhou.gov.cn/2023symfc/shuangydb/202310/a331e7b6a931423d904a0f79c74af94e.shtml',
    '苏州市张家港市双山岛西北主江堤内侧', 31.9941969, 120.3911573, 'wgs84',
    '张家港市政府 / OpenStreetMap',
    'https://www.openstreetmap.org/?mlat=31.9941969&mlon=120.3911573', 'verified', 151, true,
    null, null, null, null, null,
    '开放安排受轮渡班次影响，出行前请向度假区复核。',
    '团队活动需提前确认轮渡班次和接待安排。',
    '双山岛渡口慢街→海棠湾→老圩村清风文化荷园→渡江胜利公园→大伯墩生态湿地公园。'
  ),
  (
    152, '渡江胜利纪念馆', '红色资源', '南京市', '鼓楼区',
    '围绕渡江战役胜利和南京解放设置基本陈列，由主展馆、下沉式广场和胜利广场等部分组成。',
    '可联系', '⌖', '咨询电话：025-84649423',
    'https://wlj.nanjing.gov.cn/whcg/bwg/njsdjsljng/201807/t20180731_1078648.html',
    '南京市鼓楼区渡江路1号', 32.073563, 118.73173, 'gcj02',
    '南京市文旅局 / 高德地图',
    'https://www.amap.com/place/B00190BJ76', 'verified', 152, true,
    null, null, null, null, null,
    '周二至周日9:00—17:00，16:30停止入馆；最新安排以场馆公告为准。',
    '大型团队建议提前确认讲解和活动安排。',
    '主题陈列→渡江第一船、京电号实境展项→渡江战役总前委雕塑。'
  ),
  (
    153, '雨花台烈士纪念馆', '红色资源', '南京市', '雨花台区',
    '以雨花英烈生平事迹为核心，系统展示新民主主义革命时期雨花英烈的事迹与精神。',
    '可联系', '⌖', '预约咨询：025-68783096',
    'https://yht.nanjing.gov.cn/',
    '南京市雨花台区雨花路215号', 31.997211, 118.780429, 'gcj02',
    '雨花台烈士纪念馆 / 高德地图',
    'https://www.amap.com/place/B0019098C1', 'verified', 153, true,
    true, null, '馆方提供纪念馆讲解预约服务；公开公告未说明收费标准。',
    'https://www.njyh.gov.cn/zt/wyyh/wzyh/202503/t20250310_5091812.html', date '2026-09-08',
    '周二至周日8:30开馆，16:00停止入馆，17:00闭馆；周一闭馆，法定节假日安排以公告为准。',
    '讲解、凭吊等服务请至少提前1个工作日预约。',
    '烈士就义群雕→烈士纪念碑→倒影池→纪念馆→忠魂亭。'
  ),
  (
    154, '中共代表团梅园新村纪念馆', '红色资源', '南京市', '玄武区',
    '由中共代表团办事处旧址、国共南京谈判史料陈列馆、周恩来铜像和周恩来图书馆等组成。',
    '可联系', '⌖', '咨询电话：025-84540739',
    'https://wlj.nanjing.gov.cn/whcg/bwg/zgdbtmyxcjng/201807/t20180731_1078650.html',
    '南京市玄武区汉府街18-1号', 32.042379, 118.801602, 'gcj02',
    '南京市文旅局 / 高德地图',
    'https://ditu.amap.com/place/B001907IVB', 'verified', 154, true,
    null, null, null, null, null,
    '9:00—17:30，周一闭馆；最新安排以场馆公告为准。',
    '团队参观建议提前电话确认。',
    '周恩来铜像→国共南京谈判史料陈列馆→梅园新村30号、35号、17号旧址→周恩来图书馆。'
  )
on conflict (id) do nothing;
