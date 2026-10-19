export const EVIDENCE_SECTIONS=['overview','sources','validation','guide'] as const;
export type EvidenceSection=typeof EVIDENCE_SECTIONS[number];
export const EVIDENCE_SECTION_NAMES={overview:'Overview',sources:'Data sources',validation:'Validation',guide:'Help & glossary'};
export const FAQS=[
 {id:'forecast',category:'Interpretation',question:'Where is the seven-day outlook, and is it a probability?',answer:'Open 7-day outlook from the sidebar or command-centre card. It is a formula-based projection of seven future dates using eligible sensor history and recent symptom reports. Its 0–100 points describe projected change, not the chance of an exacerbation. A calibrated clinical forecast remains unavailable. Unknown inputs stay unknown; clinical predictive accuracy and calibrated event probabilities remain unestablished. The synthetic next-day ML experiment is a different outcome.'},
 {id:'two-clocks',category:'Data',question:'What is the difference between measured and available time?',answer:'Measurement time describes when a reading ended. Availability time describes when it could enter a historical decision. A reading appears only after both clocks have passed. The public-source 24-hour processing lag is a retrospective engineering assumption, not a measured live delay.'},
 {id:'stale',category:'Data',question:'Does a stale or missing reading mean something is wrong?',answer:'A stale flag describes the reading’s age under the source engine’s rules. Missing means unknown. Neither state establishes clinical deterioration, stability or a normal reading.'},
 {id:'heart-rate',category:'Data',question:'Why can one patient have several heart-rate streams?',answer:'Different contexts and source series stay separate, such as wrist PPG, sleep and spirometer sessions. Combining them into a single heart-rate value would erase their measurement context.'},
 {id:'baseline',category:'Interpretation',question:'What does a personal baseline or trend establish?',answer:'A baseline summarizes prior observed days for a particular stream. A trend is a descriptive change in recorded values. Neither is a diagnosis, calibrated forecast or causal explanation.'},
 {id:'coverage',category:'Interpretation',question:'Is seven-day channel coverage a measure of device adherence?',answer:'No. A channel-day is counted when at least one valid reading from that UTC measurement day was available at the selected decision. This does not measure wear time, device uptime, clinical accuracy or continuous observation.'},
 {id:'simulator',category:'Demo',question:'Does the simulator run a new model when I load a comparison?',answer:'It loads previously generated fictional v2 outputs. The reference and variant share declared exogenous keys. Browser controls select existing scenarios and views; they do not regenerate data, tune coefficients or establish real-patient treatment effects.'},
 {id:'null-control',category:'Demo',question:'Why does the null-exposure scenario match the reference?',answer:'The default exposure effect is already zero. The null-exposure variant is an intentional paired negative control and should match the default exactly.'},
 {id:'check-in',category:'Privacy',question:'Where is my symptom check-in saved?',answer:'The interactive form is restricted to the fictional profile. Confirmed entries are saved by the local backend with a UTC receipt, without sending a clinical notification. They stay separate from historical archived diaries. Do not enter private patient records into this demonstration.'},
 {id:'seen',category:'Privacy',question:'What does marking a review notice seen do?',answer:'It saves the notice identifier and a client timestamp in this browser. It does not resolve missing data, change source observations, send a message or create a backend clinical acknowledgement.'},
 {id:'login',category:'Privacy',question:'Is choosing a patient perspective the same as signing in?',answer:'Demo access uses signed backend sessions and role checks. Patient sessions are bound to a fictional profile; this is not a production clinical identity system. Public archive observations are read through the local backend.'},
 {id:'timezone',category:'Demo',question:'Which dates change when I choose a display timezone?',answer:'Detailed times in Patient Workspace, Patient Portal, Data & Devices and Review Queue use your selected timezone. Directory calendar dates, chart calendar dates, daily coverage, simulator days, reports, JSON timestamps and symptom-onset input offsets keep their original UTC or explicitly chosen clock.'},
 {id:'units',category:'Data',question:'Can I change the measurement units?',answer:'The frontend retains the source units: percent, bpm, breaths per minute, hours, metres per second and AQI. It does not convert AQI into pollutant concentration or gait speed into steps. No alternate unit conversion is offered.'},
 {id:'backend',category:'Demo',question:'How can I check the backend connection?',answer:'Settings checks the local API health endpoint. Patient history is rebuilt by the monitoring engine; check-ins and acknowledgements persist on the server. The simulator offers frozen comparisons and separate on-demand Python runs. Physical wearable pairing remains unavailable.'},
 {id:'reports',category:'Demo',question:'What is included in a downloaded report?',answer:'The selected patient and historical decision, source/context and units, missingness, descriptive trends, archived diary and provenance. Reports stay in UTC. Current browser check-ins are excluded; no clinician signature or approval is invented.'},
 {id:'preferences',category:'Privacy',question:'Do display preferences change the source data?',answer:'No. Timezone, motion and spacing are browser display preferences. A save must be read back before it is confirmed. Resetting display preferences does not remove check-ins or review marks. Demo selection is separate and scoped to the current tab.'},
] as const;
export const GLOSSARY=[
 {term:'As-of decision',definition:'The historical cut-off that determines which records could be known.'},
 {term:'Availability',definition:'When a measurement or report could enter the observed state.'},
 {term:'Baseline',definition:'A descriptive reference from prior observed days for the same source stream.'},
 {term:'Channel-day',definition:'One UTC day with at least one valid, already-available channel observation.'},
 {term:'Context',definition:'The conditions or collection method associated with a source stream.'},
 {term:'Fictional scenario',definition:'A generated engineering sensitivity experiment with declared assumptions.'},
 {term:'Positive-window recall',definition:'The fraction of labelled positive daily windows detected at the frozen threshold.'},
 {term:'Prediction coverage',definition:'The fraction of assessed calendar days with an eligible runtime prediction.'},
 {term:'Provenance',definition:'The source and version references needed to trace an observation or export.'},
 {term:'Source stream',definition:'A distinct channel, context and device or series identity.'},
 {term:'Stale',definition:'A source-engine age flag, not a clinical diagnosis.'},
 {term:'Unavailable forecast',definition:'No validated event probability is supplied; the value remains null.'},
] as const;
export function searchHelp(query:string,category:string='All'){
 const term=query.trim().toLowerCase();return FAQS.filter(row=>(category==='All'||row.category===category)&&(!term||`${row.question} ${row.answer}`.toLowerCase().includes(term)));
}
export interface ProjectEvidence {
 schemaVersion:string;clinicalValidation:false;forecastStatus:'unavailable';
 source:{label:string;url:string;license:string;participants:number;fictionalExamples:number;archiveSha256:string;syntheticSha256:string};
 history:{observations:number;snapshots:number};simulator:{version:string;scenarios:number;exportedProfiles:number;packageSha256:string;liveExecution:false};
 experiments:{name:string;origin:string;cohort:string;rows:number;positiveWindows:number;accuracy:number;noEventAccuracy:number;recall:number;precision:number;rocAuc:number;predictionCoverage:number|null;interpretation:string}[];
 auditSourcesSha256:Record<string,string>;interpretation:string;
}
export function validateProjectEvidence(value:unknown):asserts value is ProjectEvidence{
 const d=value as ProjectEvidence,hash=/^[a-f0-9]{64}$/;
 if(!d||d.schemaVersion!=='pulmira-project-evidence-1.0.0'||d.clinicalValidation!==false||d.forecastStatus!=='unavailable'||d.source?.participants!==0||d.source?.fictionalExamples!==1||d.source?.url!=='https://zenodo.org/records/23263785'||d.source?.license!=='CC BY 4.0'||!hash.test(d.source.archiveSha256)||!hash.test(d.source.syntheticSha256)||d.history?.observations!==87||d.history?.snapshots!==21||d.simulator?.version!=='synthetic_copd_v2'||d.simulator?.liveExecution!==false||d.simulator?.scenarios!==16||d.simulator?.exportedProfiles!==2||!hash.test(d.simulator.packageSha256)||!Array.isArray(d.experiments)||d.experiments.length!==2)throw new Error('The evidence summary failed its source or version checks.');
 for(const row of d.experiments)if(!Number.isInteger(row.rows)||row.rows<=0||!Number.isInteger(row.positiveWindows)||row.positiveWindows<0||row.positiveWindows>row.rows||['accuracy','noEventAccuracy','recall','precision','rocAuc'].some(key=>typeof row[key as 'accuracy']!=='number'||!Number.isFinite(row[key as 'accuracy'])||row[key as 'accuracy']<0||row[key as 'accuracy']>1)||(row.predictionCoverage!==null&&(!Number.isFinite(row.predictionCoverage)||row.predictionCoverage<0||row.predictionCoverage>1)))throw new Error('The archived experiment metrics are invalid.');
 if(!d.auditSourcesSha256||Object.keys(d.auditSourcesSha256).length!==3||Object.values(d.auditSourcesSha256).some(v=>!hash.test(v)))throw new Error('The evidence audit references are invalid.');
}
