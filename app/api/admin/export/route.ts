import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

interface ExportRow { date:string;outlet_name:string;product:string;quantity_delivered:number;status:string|null;unit_price:number;taxable_amount:number;tax_paid:number;total_revenue:number;record_type:string;sku:string;recorded_by:string; }
interface ProductRow { id:string;sku:string;name:string;category:string;current_stock:number;low_stock_threshold:number;is_active:boolean;description:string|null; }
interface OutletRow { id:string;name:string;type:string; }
interface StockRow { outlet_id:string;product_id:string;stock_bottles:number; }
interface PriceRow { product_sku:string;product_name:string;version:number|null;tax_rate:number|null;bottle_price_before_tax:number|null;bottle_price_after_tax:number|null;pack_price_before_tax:number|null;pack_price_after_tax:number|null;effective_from:string|null; }
interface UserRow { display_name:string;username:string;role:string;analytics_access:boolean;must_reset_password:boolean;created_at:string; }
const RED='FFE4402A',DARK='FF201512',CREAM='FFF6E9D4',AMBER='FFEDA83B',GREEN='FF5B8C3E';

export async function GET(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!url||!anon)return NextResponse.json({error:'Supabase is not configured.'},{status:503});
  if(!token)return NextResponse.json({error:'Authentication required.'},{status:401});
  const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc('get_accounting_export');
  if(error)return NextResponse.json({error:error.message},{status:error.message.includes('Root Owner')?403:400});
  const [productsResult,outletsResult,stockResult,pricesResult,usersResult]=await Promise.all([
    client.from('products').select('*').order('category').order('name'),
    client.from('outlets').select('*').order('type').order('name'),
    client.from('outlet_inventory').select('*'),
    client.rpc('get_current_prices'),
    client.rpc('list_user_profiles'),
  ]);
  const secondaryError=productsResult.error??outletsResult.error??stockResult.error??pricesResult.error??usersResult.error;
  if(secondaryError)return NextResponse.json({error:secondaryError.message},{status:400});
  const rows=(data as ExportRow[])??[];const products=(productsResult.data??[]) as ProductRow[];const outlets=(outletsResult.data??[]) as OutletRow[];const stock=(stockResult.data??[]) as StockRow[];const prices=(pricesResult.data??[]) as PriceRow[];const users=(usersResult.data??[]) as UserRow[];
  const workbook=new ExcelJS.Workbook();workbook.creator='KONJO IMS';workbook.company='KONJO Foods';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;
  const summary=workbook.addWorksheet('Summary',{views:[{showGridLines:false}]});summary.properties.tabColor={argb:RED};summary.mergeCells('A1:H2');const title=summary.getCell('A1');title.value='KONJO FOODS — ACCOUNTING EXPORT';title.font={name:'Aptos Display',size:22,bold:true,color:{argb:CREAM}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}};title.alignment={vertical:'middle',horizontal:'left'};
  summary.getCell('A4').value='Generated';summary.getCell('B4').value=new Date();summary.getCell('B4').numFmt='yyyy-mm-dd hh:mm';summary.getCell('A5').value='Currency';summary.getCell('B5').value='ETB';summary.getCell('A6').value='Rows';summary.getCell('B6').value=rows.length;
  const cards=[['Gross Revenue',rows.reduce((s,r)=>s+Number(r.total_revenue),0),RED],['Net Revenue (Before Tax)',rows.reduce((s,r)=>s+Number(r.taxable_amount),0),GREEN],['Tax Liability',rows.reduce((s,r)=>s+Number(r.tax_paid),0),AMBER],['Bottles Delivered',rows.reduce((s,r)=>s+Number(r.quantity_delivered),0),DARK]] as const;
  cards.forEach(([label,value,color],i)=>{const col=1+i*2;summary.mergeCells(8,col,8,col+1);summary.mergeCells(9,col,10,col+1);const h=summary.getCell(8,col),v=summary.getCell(9,col);h.value=label;h.font={bold:true,color:{argb:CREAM},size:10};h.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};h.alignment={horizontal:'center'};v.value=value;v.numFmt=label==='Bottles Delivered'?'#,##0':'#,##0.00 "ETB"';v.font={bold:true,size:16,color:{argb:DARK}};v.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFFFF'}};v.alignment={horizontal:'center',vertical:'middle'};});
  summary.columns=[{width:18},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18}];summary.getRow(1).height=26;summary.getRow(9).height=26;
  const sheet=workbook.addWorksheet('Transactions',{views:[{state:'frozen',xSplit:2,ySplit:1,showGridLines:false}]});sheet.properties.tabColor={argb:GREEN};
  const headers=['Date','Supermarket/Outlet Name','Product','Quantity Delivered','Status','Unit Price','Taxable Amount','Tax Paid','Total Revenue','Record Type','SKU','Recorded By'];sheet.addRow(headers);rows.forEach(r=>sheet.addRow([new Date(r.date),r.outlet_name,r.product,Number(r.quantity_delivered),r.status??(r.record_type==='SALE'?'PAID':''),Number(r.unit_price),Number(r.taxable_amount),Number(r.tax_paid),Number(r.total_revenue),r.record_type,r.sku,r.recorded_by]));
  const header=sheet.getRow(1);header.height=24;header.eachCell(cell=>{cell.font={bold:true,color:{argb:CREAM}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}};cell.alignment={vertical:'middle'};});
  sheet.autoFilter={from:'A1',to:'L1'};sheet.columns=[16,28,28,18,22,16,18,16,18,14,15,22].map(width=>({width}));
  ['A'].forEach(col=>sheet.getColumn(col).numFmt='yyyy-mm-dd hh:mm');['F','G','H','I'].forEach(col=>sheet.getColumn(col).numFmt='#,##0.00 "ETB";[Red](#,##0.00 "ETB");-');sheet.getColumn('D').numFmt='#,##0';
  sheet.eachRow((row,index)=>{if(index===1)return;row.height=20;if(index%2===0)row.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8F3EC'}});const status=String(row.getCell(5).value??'');row.getCell(5).font={bold:true,color:{argb:status==='PAID'?GREEN:status==='PENDING_ORDER'?AMBER:RED}};});
  const totalRow=sheet.addRow(['TOTAL','','', {formula:`SUM(D2:D${rows.length+1})`},'','',{formula:`SUM(G2:G${rows.length+1})`},{formula:`SUM(H2:H${rows.length+1})`},{formula:`SUM(I2:I${rows.length+1})`},'','','']);totalRow.font={bold:true,color:{argb:CREAM}};totalRow.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}});
  const addDataSheet=(name:string,headers:string[],records:(string|number|boolean|null)[][],widths:number[])=>{const ws=workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1,showGridLines:false}]});ws.addRow(headers);records.forEach(record=>ws.addRow(record));ws.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:CREAM}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}};});ws.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};ws.columns=widths.map(width=>({width}));ws.eachRow((row,index)=>{if(index>1&&index%2===0)row.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8F3EC'}})});return ws;};
  addDataSheet('Factory Inventory',['SKU','Product','Category','Current Stock','Low Stock Threshold','Active','Description'],products.map(p=>[p.sku,p.name,p.category,Number(p.current_stock),Number(p.low_stock_threshold),Boolean(p.is_active),p.description??'']),[16,28,20,16,20,10,42]);
  const productMap=new Map(products.map(p=>[p.id,p])),outletMap=new Map(outlets.map(o=>[o.id,o]));
  addDataSheet('Outlet Stock',['Outlet','Type','Product','SKU','Bottles Remaining'],stock.map(s=>{const o=outletMap.get(s.outlet_id),p=productMap.get(s.product_id);return[o?.name??'Unknown',o?.type??'',p?.name??'Unknown',p?.sku??'',Number(s.stock_bottles)]}),[28,18,28,16,20]);
  const priceSheet=addDataSheet('Prices',['SKU','Product','Version','Tax Rate','Bottle Before Tax','Bottle After Tax','Pack Before Tax','Pack After Tax','Effective From'],prices.map(p=>[p.product_sku,p.product_name,Number(p.version??0),Number(p.tax_rate??0),Number(p.bottle_price_before_tax??0),Number(p.bottle_price_after_tax??0),Number(p.pack_price_before_tax??0),Number(p.pack_price_after_tax??0),p.effective_from??'Not configured']),[16,28,10,12,20,20,20,20,22]);priceSheet.getColumn(4).numFmt='0.0%';[5,6,7,8].forEach(column=>priceSheet.getColumn(column).numFmt='#,##0.00 "ETB"');
  addDataSheet('Employees',['Display Name','Username','Role','Analytics Access','Password Reset Required','Created'],users.map(u=>[u.display_name,u.username,u.role,Boolean(u.analytics_access),Boolean(u.must_reset_password),u.created_at]),[28,20,16,18,24,22]);
  const checks=workbook.addWorksheet('Checks',{views:[{showGridLines:false}]});checks.columns=[{width:30},{width:18},{width:18},{width:16},{width:45}];checks.addRow(['ACCOUNTING CONTROL','Actual','Expected','Status','Notes']);checks.addRow(['Taxable + Tax = Total',rows.reduce((s,r)=>s+Number(r.taxable_amount)+Number(r.tax_paid)-Number(r.total_revenue),0),0,{formula:'IF(ABS(B2-C2)<0.02,"PASS","FAIL")'},'Difference must be less than ETB 0.02']);checks.addRow(['Negative quantities',rows.filter(r=>Number(r.quantity_delivered)<0).length,0,{formula:'IF(B3=C3,"PASS","FAIL")'},'No negative delivered quantities']);checks.addRow(['Missing outlet/product',rows.filter(r=>!r.outlet_name||!r.product).length,0,{formula:'IF(B4=C4,"PASS","FAIL")'},'Required labels present']);checks.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:CREAM}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}};});checks.getColumn('B').numFmt='#,##0.00';checks.getColumn('C').numFmt='#,##0.00';
  const buffer=await workbook.xlsx.writeBuffer();const date=new Date().toISOString().slice(0,10);
  return new NextResponse(Buffer.from(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="KONJO-Accounting-Export-${date}.xlsx"`,'Cache-Control':'no-store'}});
}
