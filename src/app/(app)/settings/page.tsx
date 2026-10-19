import { totpSecret } from '@/lib/auth';
import { calendarToken, getFeishu } from '@/lib/notify';
import { getPrefs, getSetting } from '@/lib/settings';
import { listTokens } from '@/lib/tokens';
import { AiAccess } from '@/components/app/AiAccess';
import { Icon } from '@/components/icons';
import { ImportButton, RestoreButton } from '@/components/app/ImportExport';
import { CalendarSetting, FeishuSetting, LogoutOthers, PasswordSetting, PrefsForm, TotpSetting } from '@/components/app/SettingsUI';

export default function SettingsPage() {
  const prefs = getPrefs();
  return (
    <>
      <section className="card" id="remind">
        <div className="card-h"><h2>提醒</h2></div>
        <PrefsForm remindDays={prefs.remindDays} displayName={prefs.displayName} budgetCents={prefs.budgetCents} />
        <CalendarSetting token={calendarToken()} />
        <FeishuSetting initial={getFeishu()} />
      </section>
      <section className="card" id="data">
        <div className="card-h"><h2>数据</h2></div>
        <div className="set">
          <div><h3>批量导入</h3><p>下载 Excel 模板，填写后上传；也支持 CSV</p></div>
          <div className="ctl"><ImportButton label="导入数据" /><a className="btn-text" href="/api/import-template">下载模板</a></div>
        </div>
        <div className="set">
          <div><h3>导出</h3><p>Excel / CSV 方便查看，JSON 是完整备份，可以原样恢复</p></div>
          <div className="ctl">
            <a className="btn" href="/api/export?format=xlsx"><Icon name="down" />Excel</a>
            <a className="btn" href="/api/export?format=csv">CSV</a>
            <a className="btn" href="/api/export?format=json">JSON 备份</a>
          </div>
        </div>
        <div className="set">
          <div><h3>从备份恢复</h3><p>用 JSON 备份覆盖当前数据，操作前会自动再备份一次</p></div>
          <div className="ctl"><RestoreButton /></div>
        </div>
        <div className="set">
          <div><h3>自动备份</h3><p>服务器每天自动备份一次数据库，保留最近 30 天</p></div>
          <div className="ctl t2" style={{ fontSize: 13 }}>位置：data/backups/　最近一次：{getSetting('last_backup') ?? '尚未备份'}</div>
        </div>
      </section>
      <section className="card" id="ai">
        <div className="card-h"><h2>AI 接入</h2></div>
        <AiAccess tokens={listTokens()} />
      </section>
      <section className="card" id="security">
        <div className="card-h"><h2>安全</h2></div>
        <PasswordSetting changed={getSetting('password_changed') ?? ''} />
        <TotpSetting enabled={!!totpSecret()} />
        <div className="set">
          <div><h3>登录设备</h3><p>让所有其他已登录的设备立即退出</p></div>
          <div className="ctl"><LogoutOthers /></div>
        </div>
      </section>
    </>
  );
}
