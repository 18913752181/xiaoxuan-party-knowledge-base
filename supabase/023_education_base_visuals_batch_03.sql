-- education-base-visuals 第 3 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (150, '/images/education-bases/base-150-songhu-county-committee-cover.webp', '中共淞沪中心县委纪念馆主题插画', 'https://js.cnr.cn/qxlb/20220930/t20220930_526024433.shtml', 'reference-only'),
  (151, '/images/education-bases/base-151-shuangshan-victory-crossing-cover.webp', '双山岛渡江胜利公园主题插画', 'https://www.suzhou.gov.cn/2023symfc/shuangydb/202310/a331e7b6a931423d904a0f79c74af94e.shtml', 'reference-only'),
  (152, '/images/education-bases/base-152-victory-crossing-memorial-cover.webp', '渡江胜利纪念馆主题插画', 'https://yht.nanjing.gov.cn/rednanjing/hszxmap/202506/t20250611_5583639.html', 'reference-only'),
  (153, '/images/education-bases/base-153-yuhuatai-martyrs-memorial-cover.webp', '雨花台烈士纪念馆主题插画', 'https://yht.nanjing.gov.cn/rednanjing/hszxmap/202506/t20250611_5583622.html', 'reference-only'),
  (154, '/images/education-bases/base-154-meiyuan-xincun-memorial-cover.webp', '中共代表团梅园新村纪念馆主题插画', 'https://wlj.nanjing.gov.cn/whcg/bwg/zgdbtmyxcjng/201807/t20180731_1078650.html', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
