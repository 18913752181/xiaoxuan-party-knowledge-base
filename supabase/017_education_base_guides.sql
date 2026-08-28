alter table public.education_bases
  add column if not exists has_guided_tour boolean,
  add column if not exists guide_fee text,
  add column if not exists guide_service_note text,
  add column if not exists guide_source_url text,
  add column if not exists guide_verified_at date;

comment on column public.education_bases.has_guided_tour is '是否确认提供讲解；null 表示公开信息不足，不得解释为无讲解';
comment on column public.education_bases.guide_fee is '公开讲解收费口径；未查到可靠信息时保持 null';
comment on column public.education_bases.guide_service_note is '讲解预约、场次、人数等补充说明';
comment on column public.education_bases.guide_source_url is '讲解信息公开来源';
comment on column public.education_bases.guide_verified_at is '讲解信息最近核验日期';

update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='公开资料确认提供讲解服务，收费标准未见公开说明。', guide_source_url='https://www.suzhou.gov.cn/szsrmzf/szyw/202512/9ef543d829364da0a372d402dafc5b9b.shtml', guide_verified_at=date '2026-08-28' where id=14;
update public.education_bases set has_guided_tour=true, guide_fee='免费（定点讲解）', guide_service_note='场馆实行定点免费讲解，具体场次以场馆最新开放信息为准。', guide_source_url='https://www.szgmbwg.org.cn/', guide_verified_at=date '2026-08-28' where id=29;
update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='团队讲解可预约，收费标准未见公开说明；预约电话以场馆服务指南为准。', guide_source_url='https://www.nanhujng.cn/fwzn/202503/t20250306_3105610.shtml', guide_verified_at=date '2026-08-28' where id=34;
update public.education_bases set has_guided_tour=true, guide_fee='免费（公益定时讲解）', guide_service_note='馆方提供公益定时中文讲解；团队讲解需按馆方要求预约，场次以最新公告为准。', guide_source_url='https://www.yida1921.cn/', guide_verified_at=date '2026-08-28' where id=53;
update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='公开资料确认提供中英文语音导览及可预约讲解项目，收费标准未见公开说明。', guide_source_url='https://www.jingan.gov.cn/rmtzx/003001/20260724/6104713c-a238-4174-97bd-3bbf5e5e7660.html', guide_verified_at=date '2026-08-28' where id=54;
update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='公开资料确认场馆设有讲解服务，收费标准未见公开说明。', guide_source_url='https://xxgk.shbsq.gov.cn/article.html?infoid=0a3a2cf6-c0aa-4a7b-9cfa-cd93991cd83e', guide_verified_at=date '2026-08-28' where id=55;
update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='公开报道确认馆内有现场讲解服务，收费标准未见公开说明。', guide_source_url='https://cpc.people.com.cn/n1/2025/0408/c64387-40455296.html', guide_verified_at=date '2026-08-28' where id=88;
update public.education_bases set has_guided_tour=true, guide_fee=null, guide_service_note='公开活动资料确认有现场讲解，日常预约方式及收费标准未见公开说明。', guide_source_url='https://www.suzhou.gov.cn/szsrmzf/qxkx/202607/efe4c6f889044f528289739007288d9c.shtml', guide_verified_at=date '2026-08-28' where id=95;
update public.education_bases set has_guided_tour=true, guide_fee='中文200元起/团；英文700元/次；小语种600元/次', guide_service_note='全程约45分钟。中文价含1名讲解员及20台接收器，超出每台20元，每团不超过30人；需提前3天预约。', guide_source_url='https://www.szyyjzbwg.com/jq.html', guide_verified_at=date '2026-08-28' where id=110;
