<script lang="ts">
  // Imports
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SalesOrder } from '$lib/types';
  import type { PageData } from '../../routes/$types';
  import Swal from 'sweetalert2';
  import { Info, Check, X } from 'lucide-svelte';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { MoreVertical, AlertCircle, CheckCircle, Trash2, Paperclip, Eye, Edit } from 'lucide-svelte';
  import { jsPDF } from 'jspdf';
  import 'jspdf-autotable';
  import { loading } from '$lib/stores/Loadings';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import NotoSansRegular from './NotoSans-Regular.ttf';

  // Add these properties
  export let username: string;
  export let userRole: string;
  export let currentStage: number | null;
  export let data: PageData;
  export let salesOrder: SalesOrder;
  const dispatch = createEventDispatcher();
  const STORAGE_KEY = 'lineItemsStatus';
  let originalData: any = {};
  let originalLineItemsStatus: { [key: string]: string } = {};

  type Role = 'ADMIN' | 'USER' | 'ACCOUNTANT' | 'MATERIALPROCURE' | 'WAREHOUSE' | 'OPERATION' | 'MANAGER';
  async function logFieldChange(fieldName: string, oldValue: any, newValue: any) {
  const action = 'Field Updated';
  const details = `Updated ${fieldName} from "${oldValue}" to "${newValue}"`;
  
  try {
    const response = await fetch('/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        salesOrderId: salesOrder.salesorder_number,
        username,
        role: userRole,
        action,
        details,
        category: 'field_update'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to log activity');
    }

    dispatch('activityLogged');
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

async function logLineItemChange(itemId: string, itemName: string, oldStatus: string, newStatus: string) {
  const action = 'Line Item Status Updated';
  const details = `Updated status of "${itemName}" (ID: ${itemId}) from "${oldStatus}" to "${newStatus}"`;
  
  try {
    const response = await fetch('/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        salesOrderId: salesOrder.salesorder_number,
        username,
        role: userRole,
        action,
        details,
        category: 'line_item_update'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to log activity');
    }

    dispatch('activityLogged');
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

  interface StageData {
  title: string;
  completed: boolean;
  visible: boolean;
  editableRoles: Role[];
}
  let isEditing = false;
  async function logActivity(action: string, details: string) {
  try {
    const response = await fetch('/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        salesOrderId: salesOrder.salesorder_number,
        username,
        role: userRole,
        action,
        details,
        category: 'stage_update'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to log activity');
    }

    // Notify parent component that a new log has been added
    dispatch('activityLogged');
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

  // Define stage data with role-based edit permissions
  let stageData: StageData[] = [
  { 
    title: 'Stage 0. Site Not Ready', 
    completed: false, 
    visible: true,
    editableRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT']
  },
  { 
    title: 'Stage 1. Logistics', 
    completed: false, 
    visible: true,
    editableRoles: ['ADMIN', 'MANAGER', 'WAREHOUSE']
  },
  { 
    title: 'Stage 2. Material to Procure', 
    completed: false, 
    visible: true,
    editableRoles: ['ADMIN', 'MANAGER', 'MATERIALPROCURE']
  },
  { 
    title: 'Stage 3. On Going', 
    completed: false, 
    visible: true,
    editableRoles: ['ADMIN', 'MANAGER', 'OPERATION']
  },
  { 
    title: 'Stage 4. Return Pickup', 
    completed: false, 
    visible: false,
    editableRoles: ['ADMIN', 'MANAGER', 'OPERATION']
  },
  { 
    title: 'Stage 5. Share with Account', 
    completed: false, 
    visible: true,
    editableRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT']
  }
];



$: console.log('Current stage in modal:', currentStage);
let moveStage=currentStage;
$: console.log('Move stage in modal:', moveStage);

export let Stage0Data: any;
export let lineItemsWithStatus: LineItem[]=[];
export let dcBoxes: DCBox[]=[];
export let Stage3Data: any;
export let Stage4Data: any;
export let Stage5Data: any;
export let notAvailableItems: LineItem[]=[];

onMount(async () => {
  if (currentStage !== null && currentStage !== 0) {
    console.log("R u inside func");
    await fetchPreviousStagesData();
    for (let i = 0; i < currentStage; i++) {
      stageData[i].completed = true;
    }

    console.log(" 0 DATA- ", Stage0Data);
    console.log(" itms DATA- ", lineItemsWithStatus);
    console.log(" dc DATA- ", dcBoxes);
    console.log(" 3 DATA- ", Stage3Data);
    console.log(" 4 DATA- ", Stage4Data);
    console.log(" 5 DATA- ", Stage5Data);
    console.log("hey");
    notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available')
  }})

 if ( currentStage === 0) {
  currentStage = moveStage= 0;
  Stage0Data = {
      SONumber: salesOrder.salesorder_number,
      SOId: salesOrder.salesorder_id,
      clientName: salesOrder.customer_name,
      SubTotal: salesOrder.sub_total,
      Total: salesOrder.total,
      SOCategory: salesOrder.custom_field_hash.cf_so_cat,
      projectManagerName: salesOrder.custom_field_hash.cf_project_manager_name,
      clientExpectedDate: ''
  };
  lineItemsWithStatus= salesOrder.line_items.map(item => ({
    Itemid: item.line_item_id || '',  
    SONumber: salesOrder.salesorder_number,
    isAvailabilityFrozen: false,   
    isAvailable: false,   
    needToPurchaseLocally: false,          
    name: item.name || item.group_name,  
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    amount: item.item_total,
    status: '',
    serialNo:'',
    invoiceNo: '',
    invoiceattachment: ''
  }));
  dcBoxes = [{
        SONumber: salesOrder.salesorder_number,
        DCNumber: '',
        status: '',
        PODNo: '',
        DispatchDate: '',
        EstdDeliveryDate: '',
        dcAmount: 0,
        attachment: '',
        lineItemCount: 0,
        isSaved: false,
        lineItemIndices: [],
        fileName: '',
        filePreviewUrl: null,
        billType: 'DC', // Default to DC
        isTypeSet: false,
        isEditing: false,
        validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    }];
    Stage3Data = {
      SONumber: salesOrder.salesorder_number,
      engName: '',
      ScheduleDate: '',
      MobNo: '',
      VendorName: '',
      Remark: [],
      Report: '',
      ReportName:'',
      Ticketid: '',
      activeTab:'installation'
    };
    Stage4Data = {
    SONumber: salesOrder.salesorder_number,
    returnPickupRequested : false,
    ReturnPickupName : '',
    ReturnPickupMobile : '',
    ReturnPickupRemark : '',
    DCNumber:'',
    validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
    },
    CourierTrackNo:'',
    DCAmount:'',
    DispatchDate:'',
    DeliveryDate:'',
    Remark:'',
    Attachment:''
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
if ( currentStage === 1) {
  currentStage = moveStage= 1;
  if (lineItemsWithStatus.length === 0) {
    
  lineItemsWithStatus= salesOrder.line_items.map(item => ({
    Itemid: item.line_item_id || '',  
    SONumber: salesOrder.salesorder_number,
    isAvailabilityFrozen: false,   
    isAvailable: false,   
    needToPurchaseLocally: false,          
    name: item.name || item.group_name,  
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    amount: item.item_total,
    status: '',
    serialNo:'',
    invoiceNo: '',
    invoiceattachment: ''
  }));
}
  dcBoxes = [{
        SONumber: salesOrder.salesorder_number,
        DCNumber: '',
        status: '',
        PODNo: '',
        DispatchDate: '',
        EstdDeliveryDate: '',
        dcAmount: 0,
        attachment: '',
        lineItemCount: 0,
        isSaved: false,
        lineItemIndices: [],
        fileName: '',
        filePreviewUrl: null,
        billType: 'DC', // Default to DC
        isTypeSet: false,
        isEditing: false,
        validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    }];
    Stage3Data = {
      SONumber: salesOrder.salesorder_number,
      engName: '',
      ScheduleDate: '',
      MobNo: '',
      VendorName: '',
      Remark: [],
      Report: '',
      ReportName:'',
      Ticketid: '',
      activeTab:'installation'
    };
    Stage4Data = {
    SONumber: salesOrder.salesorder_number,
    returnPickupRequested : false,
    ReturnPickupName : '',
    ReturnPickupMobile : '',
    ReturnPickupRemark : '',
    DCNumber:'',
    validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    CourierTrackNo:'',
    DCAmount:'',
    DispatchDate:'',
    DeliveryDate:'',
    Remark:'',
    Attachment:''
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
if ( currentStage === 2) {
  currentStage = moveStage= 2;
    Stage3Data = {
      SONumber: salesOrder.salesorder_number,
      engName: '',
      ScheduleDate: '',
      MobNo: '',
      VendorName: '',
      Remark: [],
      Report: '',
      ReportName:'',
      Ticketid: '',
      activeTab:'installation'
    };
    Stage4Data = {
    SONumber: salesOrder.salesorder_number,
    returnPickupRequested : false,
    ReturnPickupName : '',
    ReturnPickupMobile : '',
    ReturnPickupRemark : '',
    DCNumber:'',
    validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    CourierTrackNo:'',
    DCAmount:'',
    DispatchDate:'',
    DeliveryDate:'',
    Remark:'',
    Attachment:''
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
if ( currentStage === 3) {
  currentStage = moveStage= 3;
    Stage3Data = {
      SONumber: salesOrder.salesorder_number,
      engName: '',
      ScheduleDate: '',
      MobNo: '',
      VendorName: '',
      Remark: [],
      Report: '',
      ReportName:'',
      Ticketid: '',
      activeTab:'installation'
    };
    Stage4Data = {
    SONumber: salesOrder.salesorder_number,
    returnPickupRequested : false,
    ReturnPickupName : '',
    ReturnPickupMobile : '',
    ReturnPickupRemark : '',
    DCNumber:'',
    validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    CourierTrackNo:'',
    DCAmount:'',
    DispatchDate:'',
    DeliveryDate:'',
    Remark:'',
    Attachment:''
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
if ( currentStage === 4) {
  currentStage = moveStage= 4;
  Stage4Data = {
    SONumber: salesOrder.salesorder_number,
    DCNumber:'',
    validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        },
    CourierTrackNo:'',
    DCAmount:'',
    DispatchDate:'',
    DeliveryDate:'',
    Remark:'',
    Attachment:''
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
if ( currentStage === 5) {
  currentStage = moveStage= 5;
  Stage4Data = {
    returnPickupRequested : false
  }
  Stage5Data = {
    SONumber: salesOrder.salesorder_number,
    accStatus:'', 
    rejected1 : null,
    accRemark:'',
    retaccStatus:"",   
    rejected2: null,
    retaccRemark:'',
    isDataSaved1: false,
    isEditing1: true,
    isDataSaved2: false,
    isEditing2: true
  }
}
onMount(() => {
  originalData = { ...Stage0Data };
  });

  onMount(() => {
  // Initialize the original status for each line item
  originalLineItemsStatus = lineItemsWithStatus.reduce((acc, item) => {
    acc[item.Itemid] = item.status;
    return acc;
  }, {});
});

// Function to check if the current user can edit a specific stage
function canEditStage(userRole: Role, stage: StageData,moveStage: number): boolean {
    return ((stage.editableRoles.includes(userRole) || userRole === 'ADMIN') && (moveStage >= currentStage));
  }

$: isEditing = canEditStage(data.user.role as Role, stageData[currentStage],moveStage);

// Variables for dropped and monitoring states
let isDropped = false;
  let isMonitoring = false;
  let showDroppedPopup = false;
  let showMonitoringPopup = false;
  let droppedRemarks = '';
  let monitoringRemarks = '';
  let submissionTime: Date | null = null;
  let showDropdown = false;
  let dropdownContainer: HTMLDivElement | null = null;
  let isHovered = false;


function toggleDropdown() {
  showDropdown = !showDropdown;
}

function handleClickOutside(event: MouseEvent): void {
  if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
    showDropdown = false;
  }
}

onMount(() => {
  window.addEventListener('click', handleClickOutside);

  return () => {
    window.removeEventListener('click', handleClickOutside);
  };
});

  // Functions for dropped and monitoring
  function handleDroppedToggle(): void {
    showDroppedPopup = true;
    showDropdown = false;
  }

  function handleMonitoringToggle(): void {
    showMonitoringPopup = true;
    showDropdown = false;
  }

  function submitDropped(): void {
    if (droppedRemarks.trim()) {
    isDropped = true;
    isMonitoring = false;
    submissionTime = new Date();
    showDroppedPopup = false;
    currentStage = stageData.filter(stage => stage.completed).length - 1;
  } else {
    Swal.fire({
        title: 'Oops...',
        text: 'Please provide remarks before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
  }
}

function submitMonitoring(): void {
  if (monitoringRemarks.trim()) {
    isMonitoring = true;
    isDropped = false;
    submissionTime = new Date();
    showMonitoringPopup = false;
    currentStage = stageData.filter(stage => stage.completed).length - 1;
  } else {
    Swal.fire({
        title: 'Oops...',
        text: 'Please provide remarks before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
   }
  }

  // Interfaces
  interface LineItem {
    Itemid: string;
    SONumber: string;
    isAvailabilityFrozen: any;
    needToPurchaseLocally: boolean;
	  isAvailable: boolean;
    name: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    status: string;
    serialNo?: string;
    invoiceNo?: string;
    invoiceattachment?: string;
    returnPickup?: boolean;
    returnQuantity?: number;
  }

  interface DCBox {
	  validatedData?: {
      deliverychallan_number: string;
      customer_name: string;
      date: any;
      total: number;
      status: string;
    };
    status: any;
    SONumber: string;
    DCNumber: string;
    PODNo: string;
    DispatchDate: string;
    EstdDeliveryDate: string;
    dcAmount: number;
    attachment: string;
    lineItemCount: number;
    isSaved: boolean;
    lineItemIndices: number[];
    fileName: string;
    filePreviewUrl: string | null;
    billType: 'DC' | 'E-way';
    isTypeSet: boolean;
    isEditing: boolean;
}



  let partialDelivery = false;
  let canAccessNextStage = false;
  let allItemsSaved = false;
  let newlyAvailableItems: Array<{ id: string, name: string, status: 'available' | 'need_to_purchase' }> = [];  
  let minDate: string;

function updateMinDate() {
  minDate = new Date().toISOString().split('T')[0];
}

    // Initialize with saved data immediately LOCAL STORAGE
    function initializeWithSavedData(items: LineItem[]): LineItem[] {
        if (typeof window === 'undefined') return items; // Handle SSR
        
        const savedStatuses = localStorage.getItem(STORAGE_KEY);
        if (savedStatuses) {
            const statusMap = JSON.parse(savedStatuses);
            return items.map(item => ({
                ...item,
                status: statusMap[item.Itemid] || item.status || ''
            }));
        }
        return items;
    }

        // Initialize the data immediately
        $: if (lineItemsWithStatus.length > 0) {
        lineItemsWithStatus = initializeWithSavedData(lineItemsWithStatus);
    }

        // Save changes to localStorage whenever status changes
    function handleStatusChange(index: number, newStatus: string) {
        lineItemsWithStatus[index].status = newStatus;
        const statusMap = lineItemsWithStatus.reduce((acc, item) => ({
            ...acc,
            [item.Itemid]: item.status
        }), {});
        localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
    }


    

onMount(() => {
  updateMinDate();
  const interval = setInterval(updateMinDate, 60000); // Update every minute
  return () => clearInterval(interval);
});
  

  let dcOrderTotal = { subtotal: 0, igst: 0, total: 0 };
  let userEnabledPartialDelivery = false;
  let frozenLineItems: { [key: string]: boolean } = {};
  let dcCounter = 1;

  // Reactive declarations
  $: allStatusesFilled = lineItemsWithStatus.every(item => item.status !== '');
  $: partialDelivery = userEnabledPartialDelivery && anyItemNotAvailable;

  // Lifecycle hooks
  onMount(() => {
    stageStartTimes[0] = getCurrentDateTime();
  });

  // Stage navigation functions
  function closeModal() {
    dispatch('close');
  }

  function goToNextStage() {
  if (moveStage < stageData.length - 1) {
    do {
      moveStage++;
    } while (moveStage < stageData.length && !stageData[moveStage].visible);
  }
}

function goToPreviousStage() {
  if (moveStage > 0) {
    do {
      moveStage--;
    } while (moveStage > 0 && !stageData[moveStage].visible);
  }
}

  function editStage() {
    isEditing = true;
  }

  // Form submission and validation
async function handleSubmit(event: Event) {
    event.preventDefault();
    if (currentStage === 1) {
      
    if (!allLineItemsFrozen()) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please ensure all line items are saved (Available, Need to purchase locally, or Not Required).',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!allStatusesFilled) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please select a status for all line items before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    const unfilledDCs = dcBoxes.filter(dc => !dc.isSaved && !isCurrentDCFilled());
    if (unfilledDCs.length > 0) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please fill and save all DC details before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    showConfirmationPopup = true;
  } else {
  if (currentStage === 2) {
    if (allItemsSaved) {
      showConfirmationPopup = true;
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please save all items before submitting the stage.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  } else {

  if (currentStage === (stageData[4].visible ? 5 : 4)) {
    // Share with Account stage
      const allItemsHaveStatus = [...shipments, returnPickup]
        .filter(item => item.isSaved)
        .every(item => item.accountStatus && item.accountRemark.trim());
      
      // if (allItemsHaveStatus) {
        showConfirmationPopup = true;
      // } else {
      //   await Swal.fire({
      //   title: 'Oops...',
      //   text: 'Please select a status and fill up the remark for all items.',
      //   icon: 'warning',
      //   confirmButtonText: 'OK'
      // });
      // }
    } else {
      showConfirmationPopup = true;
    }
    } 
    }
  }

  async function confirmSubmit() {
    try {
    loading.show('Submitting stage...');
    showConfirmationPopup = false;
    lastSubmittedTimes[currentStage] = getCurrentDateTime();
    // Set the start time for the next stage
    if (currentStage < stageData.length - 1) {
      stageStartTimes[currentStage + 1] = getCurrentDateTime();
    }
    switch (currentStage) {
    case 0:
      if (!Stage0Data.clientExpectedDate) {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please fill Client Expected Date of Handover.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
      } else{
        try {
          await fetch(`/submit-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: currentStage, data: Stage0Data })});
          const changedFields = [];
          for (const [key, value] of Object.entries(Stage0Data)) {
          if (value !== originalData[key]) {
            changedFields.push({ field: key, oldValue: originalData[key], newValue: value });
          }
        }
    if (changedFields.length > 0) {
    // Perform your save operation here

    // Log all changes
    for (const change of changedFields) {
      await logFieldChange(change.field, change.oldValue, change.newValue);
    }

    // Update originalData with new values
    originalData = { ...Stage0Data };
  }
        }
        catch (error) {
            console.error('Error:', error);
        }
      } 
        break;
    case 1:
      if (!allLineItemsFrozen()) {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please ensure all line items are saved (Available, Need to purchase locally, or Not Required).',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
      }
      if (!allStatusesFilled) {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please select a status for all line items before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
        return;
      }
      // Check if all items are marked as "Not Required"
      const allNotRequired = lineItemsWithStatus.every(item => item.status === 'not_required');
        
      // Only check isCurrentDCFilled() if not all items are "Not Required"
      if (!allNotRequired && !isCurrentDCFilled()) {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please fill all fields in the current DC before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
        return;
      }

  const unfilledDCs = dcBoxes.filter(dc => !dc.isSaved && !isCurrentDCFilled());
  if (unfilledDCs.length > 0) {
    await Swal.fire({
        title: 'Oops...',
        text: 'Please fill and save all DC details before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    return;
  }
      
      updateDCAmount(dcBoxes.length - 1);
      updateDCOrderTotal();
      saveCurrentState();
      const changedLineItems = lineItemsWithStatus.filter(item => 
    item.status !== originalLineItemsStatus[item.Itemid]
  );

  if (changedLineItems.length > 0) {
    // Perform your save operation here

    // Log all changes
    for (const item of changedLineItems) {
      await logLineItemChange(
        item.Itemid, 
        item.name, 
        originalLineItemsStatus[item.Itemid], 
        item.status
      );
    }

    // Update originalLineItemsStatus with new values
    changedLineItems.forEach(item => {
      originalLineItemsStatus[item.Itemid] = item.status;
    });
  }
      await Swal.fire({
        title: 'Success',
        text: 'Logistics stage completed successfully.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
      break;
    case 2:
      if (allItemsSaved) {
        await Swal.fire({
        title: 'Success',
        text: 'Material to Procure stage completed successfully.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
        stageData[currentStage].completed = true;
      } else {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please save all items before submitting the stage.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      }
      break;
    case 3:
        try {
          await fetch(`/submit-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: currentStage, data: Stage3Data })});
        }
        catch (error) {
          console.error('Error:', error);
        }
        await Swal.fire({
        title: 'Success',
        text: 'Ongoing stage has completed',
        icon: 'success',
        confirmButtonText: 'OK'
        });
      break;
    case 4:
    if (stageData[4].visible) {
      if (returnPickup.isSaved) {
        try {
          await fetch(`/submit-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: currentStage, data: Stage4Data })});
        }
        catch (error) {
          console.error('Error:', error);
        }
        await Swal.fire({
        title: 'Success',
        text: 'Return Pickup details submitted successfully.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
        stageData[4].completed = true;
        currentStage = 5; // Move to Share with Account stage
      } else {
        await Swal.fire({
        title: 'Oops...',
        text: 'Please save the Return Pickup details before submitting.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
        return;
      }
    } else {
      // Handle the case when Return Pickup is not visible (skipped)
      await Swal.fire("Moving to Share with Account stage.");
      currentStage = 5;
    }
    break;
    case (stageData[4].visible ? 5 : 4):
    const approvedItems = [Stage5Data]
      .filter(item => item.isSaved && item.accStatus === 'approved')
      .map(item => item.name || `Shipment ${item.index + 1}`);
    const rejectedItems = [Stage5Data]
      .filter(item => item.isSaved && item.accStatus === 'rejected')
      .map(item => item.name || `Shipment ${item.index + 1}`);
    
    if (approvedItems.length > 0) {
      await Swal.fire(`Approved items: ${approvedItems.join(', ')}`);
    }
    if (rejectedItems.length > 0) {
      await Swal.fire(`Rejected items: ${rejectedItems.join(', ')}`);
      showRejectionAlert = true;
    }
    try {
          await fetch(`/submit-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: currentStage, data: Stage5Data })});
        }
        catch (error) {
          console.error('Error:', error);
        }
    break;
    }

    stageData[currentStage].completed = true;
    // Automatically move to the next stage
    goToNextStage();
    if (currentStage < stageData.length - 1) {
    do {
      currentStage++;
    } while (currentStage < stageData.length && !stageData[currentStage].visible);
    }
    try {
        await fetch('/update-current-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                SONumber: Stage0Data.SONumber, // Assuming SONumber is in Stage0Data
                currentStage: currentStage // Update to the next stage
            })
        });
    } catch (error) {
        console.error('Error updating current stage:', error);
    }
  }catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while submitting. Please try again.',
            icon: 'error'
        });
    } finally {
        loading.hide();
    }
}
const resubmitReport = async (index: number) => {
  try {
    // Show loading indicator
    const loading = Swal.fire({
      title: 'Submitting...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    if (!Stage3Data.Report) {
      await Swal.fire({
        title: 'Error',
        text: 'Please upload a new file before resubmitting',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Reset rejection status
    Stage5Data.rejected1 = null;
    Stage5Data.accRemark = "";
    Stage5Data.accStatus = "";

    // Prepare submission data based on active tab
    const submissionData = {
      SONumber: Stage0Data.SONumber,
      Report: Stage3Data.Report,
      ReportName: Stage3Data.ReportName,
      Ticketid: Stage3Data.Ticketid || '',
      activeTab: Stage3Data.activeTab
    };
    console.log("submission---",submissionData);
    // Submit the data
    try {
      const response = await fetch(`/submit-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stage: 3, // Using stage 3 since this is for ongoing stage
          data: submissionData 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit data');
      }
      

      // Show success message
      await Swal.fire({
        title: 'Success',
        text: 'Report resubmitted successfully',
        icon: 'success',
        confirmButtonText: 'OK'
      });

      // Update current stage if needed
      // try {
      //   await fetch('/update-current-stage', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       SONumber: Stage0Data.SONumber,
      //       currentStage: currentStage
      //     })
      //   });
      // } catch (error) {
      //   console.error('Error updating current stage:', error);
      // }

    } catch (error) {
      console.error('Error resubmitting report:', error);
      await Swal.fire({
        title: 'Error',
        text: 'Failed to resubmit report. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }

  } catch (error) {
    console.error('Error in resubmission process:', error);
    await Swal.fire({
      title: 'Error',
      text: 'An unexpected error occurred. Please try again.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
  } finally {
    loading.hide();
  }
};

  // Helper functions
  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  }



  // DC box related functions
  let totalSavedDCAmount = 0;
  function calculateDCAmount(dcIndex: number) {
    return lineItemsWithStatus
      .filter((item, index) => 
        (item.status === 'available' || item.status === 'need_to_purchase') && 
        !frozenLineItems[index] &&
        index >= (dcIndex > 0 ? dcBoxes[dcIndex - 1].lineItemCount : 0)
      )
      .reduce((sum, item) => sum + item.amount, 0);
  }

  function updateDCOrderTotal() {
    if (allItemsNotAvailable) {
      dcOrderTotal.subtotal = 0;
    } else {
      // Calculate total of unsaved line items
    dcOrderTotal.subtotal = lineItemsWithStatus
      .filter((item) => !frozenLineItems[item.Itemid] && (item.status === 'available' || item.status === 'need_to_purchase'))
      .reduce((sum, item) => sum + item.amount, 0);
    }
    // Update the UI
    dcOrderTotal = dcOrderTotal; // Trigger reactivity
  }
  
  function getTotalSavedDCAmount() {
    return dcBoxes
      .filter(dc => dc.isSaved)
      .reduce((sum, dc) => sum + dc.dcAmount, 0);
  }
  
  function updateTotalSavedDCAmount() {
    totalSavedDCAmount = dcBoxes
      .filter(dc => dc.isSaved)
      .reduce((sum, dc) => sum + dc.dcAmount, 0);
  }

  function saveCurrentState() {
    console.log('Saving current state:', {
      lineItems: lineItemsWithStatus,
      dcOrderTotal,
      partialDelivery,
      dcBoxes
    });
    // Implement actual saving logic here
  }
  // Add a new function to handle editing
function handleEdit(index: number) {
  dcBoxes[index].isEditing = true;
  dcBoxes = [...dcBoxes]; // Trigger reactivity
}
  function canSaveDC(dc: DCBox | undefined): boolean {
  if (!dc) return false;
  return lineItemsWithStatus.every(item => item.status !== '') && isCurrentDCFilled();
}

let isSaveDisabled = false; 
  async function handleSave() {
    try{
    loading.show('Saving DC...');
    const currentDCIndex = dcBoxes.length - 1;
    const currentDC = dcBoxes[currentDCIndex];
  
    if (!canSaveDC(currentDC)) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please select a status for all line items before saving.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }else{
      isSaveDisabled = true;
      currentDC.isSaved = true;
    }

    // Clear notifications
    showLogisticsAlert = false;
    newlyAvailableItems = [];
    userEnabledPartialDelivery = false;


    // If all items are Not Available, handle it differently
  if (allItemsNotAvailable) {
    lineItemsWithStatus.forEach(item => {
      item.isAvailabilityFrozen = true;
    });
    notAvailableItems = [...lineItemsWithStatus];
    await Swal.fire({
        title: 'Oops...',
        text: 'All items have been marked as Not Available and saved.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    canAccessNextStage = true;
    return;
  }

    // If the bill type hasn't been set yet (user didn't interact with the form),
    // set it now based on the current subtotal
    if (!currentDC.isTypeSet) {
        currentDC.billType = dcOrderTotal.subtotal >= 50000 ? 'E-way' : 'DC';
        currentDC.isTypeSet = true;
    }
  
    // Rest of the save logic
    lastSavedTimes[currentStage] = getCurrentDateTime();

    // Set the DC amount to the current total before saving if it's not already saved
    if (!currentDC.isSaved) {
        currentDC.dcAmount = dcOrderTotal.subtotal;
    }
  //    if (currentDC.isSaved) {
  //   // Generate and download PDF after saving
  //   generateAndDownloadPDF(currentDC);
  // }
    try {
      await fetch(`/submit-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: currentStage, 
        data: {
        lineItems: lineItemsWithStatus,
        dcBoxes: currentDC
      } })});
    }catch (error) {
      console.error('Error:', error);
    }

  // Associate newly available or purchasable items with the current DC
  lineItemsWithStatus.forEach((item, index) => {
    if ((item.status === 'available' || item.status === 'need_to_purchase') && !frozenLineItems[item.Itemid]) {
      frozenLineItems[item.Itemid] = true;
      currentDC.lineItemIndices.push(index);
    }
    if ((item.status === 'not_required') && !frozenLineItems[item.Itemid]) {
        frozenLineItems[item. Itemid] = true;
      }
  });
  // Ensure all items in the current DC are marked as frozen
  currentDC.lineItemIndices.forEach(index => {
    frozenLineItems[lineItemsWithStatus[index].Itemid] = true;
  });

  notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available');

  currentDC.isSaved = true;
  dcBoxes = [...dcBoxes];

  // Reset the total amount for the next DC
  updateDCOrderTotal();
      
  // Update the total of saved DCs
  updateTotalSavedDCAmount();
  saveCurrentState();
  canAccessNextStage = true;
  
    if (partialDelivery && userEnabledPartialDelivery) {
    const remainingUnsavedItems = lineItemsWithStatus.filter(item => 
      !frozenLineItems[item.id] && 
      (item.status === 'available' || item.status === 'need_to_purchase')
    );

    if (remainingUnsavedItems.length === 0) {
      // All available/purchasable items have been saved in DCs, move to Material to Procure stage
      await Swal.fire({
        title: 'Moving to Material to Procure',
        text: 'All available items have been processed. Moving to Material to Procure stage for remaining items.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      moveToMaterialToProcureStage();
    } else {
      await Swal.fire({
        title: 'DC Saved',
        text: 'DC has been saved successfully.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
    }
  } else {
    await Swal.fire({
      title: 'Success',
      text: 'DC saved successfully.',
      icon: 'success',
      confirmButtonText: 'OK'
    });
  }
  if (allItemsNotAvailable) {
    await Swal.fire("All items are marked as Not Available. You cannot add more DCs.");
      } else {
        await Swal.fire({
        title: 'Success',
        text: 'Progress saved. You can now add more DCs or proceed to the next stage.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
      } 
  }catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while saving. Please try again.',
            icon: 'error'
        });
    } finally {
        loading.hide();
    }
}

  function moveToMaterialToProcureStage() {
  currentStage = 2; // Move to stage 2 (Material to Procure)
  // You might want to perform any necessary initialization for stage 2 here
  // For example:
  notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available');
}

// Add a new function to handle save after editing
function handleSaveEdit(index: number) {
  const editedDC = dcBoxes[index];

  if (!canSaveDC(editedDC)) {
    alert('Please fill all required fields before saving.');
    return;
  }

  editedDC.isSaved = true;
  editedDC.isEditing = false;
  dcBoxes = [...dcBoxes]; // Trigger reactivity

  updateDCAmount(index);
  updateTotalSavedDCAmount();
  saveCurrentState();

  alert('DC order updated successfully.');
}

async function handleSaveAllNotAvailable() {
  try{
  loading.show('Processing not available items...');
  // Update notAvailableItems for the next stage
  notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available');
  

   // Handle not required items
   const notRequiredItems = lineItemsWithStatus.filter(item => item.status === 'not_required');
  // Trigger reactivity
  lineItemsWithStatus = [...lineItemsWithStatus];

  try {
      await fetch(`/submit-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: currentStage, 
        data: {
        lineItems: lineItemsWithStatus
      } })});
    }catch (error) {
      console.error('Error:', error);
    }
  
// Show confirmation message
  if (notAvailableItems.length > 0) {
    await Swal.fire({
      title: 'Items Not Available',
      text: `${notAvailableItems.length} item(s) have been marked as Not Available and will proceed to Material to Procure stage.`,
      icon: 'info',
      confirmButtonText: 'OK'
    });
  }
  
  // Check if all items are marked as "not required"
  if (notRequiredItems.length === lineItemsWithStatus.length) {
    await Swal.fire({
      title: 'All Items Not Required',
      text: 'All items have been marked as Not Required. The current stage will be completed and we will move to the next stage.',
      icon: 'info',
      confirmButtonText: 'OK'
    });
    
    stageData[currentStage].completed = true;
    
  } else if (notRequiredItems.length > 0) {
    await Swal.fire({
      title: 'Some Items Not Required',
      text: `${notRequiredItems.length} item(s) have been marked as Not Required and will be removed from the order.`,
      icon: 'info',
      confirmButtonText: 'OK'
    });
  }
  // Save the current state
  saveCurrentState();
  
  // Determine next action based on remaining items
  if (notAvailableItems.length > 0 && notRequiredItems.length !== lineItemsWithStatus.length) {
    goToNextStage();
  }

  if (currentStage < stageData.length - 1) {
    do {
      currentStage++;
    } while (currentStage < stageData.length && !stageData[currentStage].visible);
  }
  try {
        await fetch('/update-current-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                SONumber: Stage0Data.SONumber, // Assuming SONumber is in Stage0Data
                currentStage: currentStage // Update to the next stage
            })
        });
    } catch (error) {
        console.error('Error updating current stage:', error);
    }
    
}catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while processing. Please try again.',
            icon: 'error'
        });
    } finally {
        loading.hide();
    }
}


function allLineItemsFrozen() {
  return lineItemsWithStatus.every(item => 
    frozenLineItems[item.Itemid] || 
    item.status === 'not_available' || 
    item.status === 'not_required'
  );
  }

  // Function to remove DC
  function removeDC(index: number) {
    if (index > 0 && !dcBoxes[index].isSaved) {
      dcBoxes.splice(index, 1);
      dcBoxes = dcBoxes; // Trigger reactivity
    }
  }

  // Function to add more DC
 async function addMoreDC() {
    const currentDC = dcBoxes[dcBoxes.length - 1];
    if (!currentDC.isSaved) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please save the current DC before adding a new one',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
  }

  dcCounter++;
  dcBoxes = [...dcBoxes, {
        SONumber: salesOrder.salesorder_number,
        DCNumber: '',
        status: '',
        PODNo: '',
        DispatchDate: '',
        EstdDeliveryDate: '',
        dcAmount: 0,
        attachment: '',
        lineItemCount: 0,
        isSaved: false,
        lineItemIndices: [],
        fileName: '',
        filePreviewUrl: null,
        billType: 'DC', // Default to DC
        isTypeSet: false,
        isEditing: false,
        validatedData: {
          deliverychallan_number: '',
          date: '',
          customer_name: '',
          total: 0,
          status: '',
        }, 
  }];
    // Recalculate the total for the new DC
    updateDCOrderTotal();
  }
function setBillType(index: number) {
  if (!dcBoxes[index].isTypeSet) {
    dcBoxes[index].billType = dcOrderTotal.subtotal >= 50000 ? 'E-way' : 'DC';
    dcBoxes[index].isTypeSet = true;
    dcBoxes = [...dcBoxes]; // Trigger reactivity
  }
}

  // Function to check if current DC is filled  
  function isCurrentDCFilled(): boolean {
    const currentDC = dcBoxes[dcBoxes.length - 1];
    return Boolean(
      currentDC &&
      currentDC.DCNumber.trim()!=='' && 
        currentDC.PODNo.trim()!=='' && 
        currentDC.DispatchDate !=='' && 
        currentDC.EstdDeliveryDate !=='' && 
        (currentDC.attachment || currentDC.fileName || currentDC.filePreviewUrl) &&
        currentDC.status !==''
  );
  }

// Function to update DC amount
function updateDCAmount(dcIndex: number) {
  const dc = dcBoxes[dcIndex];
  if (!dc.isSaved) {
  dc.dcAmount = dc.lineItemIndices.reduce((sum, index) => {
    const item = lineItemsWithStatus[index];
    return sum + item.amount;
  }, 0);
  dcBoxes = dcBoxes; // Trigger reactivity
  }
}
  // File handling functions
  // Reactive statement for partial delivery and DC order total
  $: {
    partialDelivery = lineItemsWithStatus.some(item => item.status === 'not_available');
    updateDCOrderTotal();
  }

  // Function to set max dispatch date
  function setMaxDispatchDate() {
    const dispatchedDateInput = document.getElementById('dispatched-date') as HTMLInputElement;
    if (dispatchedDateInput) {
      dispatchedDateInput.max = new Date().toISOString().split('T')[0];
    }
  }

  // Function to update min delivery date
  function updateMinDeliveryDate() {
    const dispatchedDateInput = document.getElementById('dispatched-date') as HTMLInputElement;
    const deliveryDateInput = document.getElementById('delivery-date') as HTMLInputElement;
    
    if (dispatchedDateInput && deliveryDateInput) {
      deliveryDateInput.min = dispatchedDateInput.value;
      
      // If the current delivery date is before the new min date, reset it
      if (deliveryDateInput.value && deliveryDateInput.value < deliveryDateInput.min) {
        deliveryDateInput.value = '';
      }
    }
  }

  // Function to validate file input
  async function validateFileInput(input: HTMLInputElement) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    const file = input.files?.[0];
    
    if (file && !allowedTypes.includes(file.type)) {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please select a PDF or image file.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      input.value = ''; // Clear the input
    }
  }

  // Function to setup event listeners
  function setupEventListeners() {
    const dispatchedDateInput = document.getElementById('dispatched-date') as HTMLInputElement;
    const attachmentInput = document.getElementById('attachment') as HTMLInputElement;
    
    if (dispatchedDateInput) {
      dispatchedDateInput.addEventListener('change', updateMinDeliveryDate);
    }
    
    if (attachmentInput) {
      attachmentInput.addEventListener('change', () => validateFileInput(attachmentInput));
    }
  }
    
  // Variables for date handling
  let dispatchedDate: string = '';
  let deliveryDate: string = '';

  // Reactive statement for date validation
  $: if (dispatchedDate) {
    // Ensure delivery date is not before dispatched date
    if (deliveryDate && deliveryDate < dispatchedDate) {
      deliveryDate = '';
    }
  }

  // Variables for file handling
  let filePreviewUrl: string | null = null;
  let fileName: string = '';
  let showCustomNameModal = false;
  let customFileName = '';

  let customFileExtension: string = '';
  let currentDCIndex: number = 0;

  // Function to handle file change
  async function handleFileChange(event: Event, dcIndex: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
      if (file) {
        showCustomNameModal = true;
        const extension = file.name.split('.').pop() || '';
        customFileName = file.name.replace(`.${extension}`, '');
        customFileExtension = extension;
        currentDCIndex = dcIndex;
      }
    if (file) {
        try{
          const base64String = await convertFileToBase64(file);
          dcBoxes[dcIndex].fileName = file.name;
          dcBoxes[dcIndex].filePreviewUrl = URL.createObjectURL(file);
          dcBoxes[dcIndex].attachment = base64String;
        }catch (error) {
          console.error('Error converting file to base64:', error);}
      }
      dcBoxes = [...dcBoxes]; // Trigger reactivity
}

  function formatCurrencyForPDF(amount: number): string {
  // Use the Unicode character for the Indian Rupee symbol
  return `\u20B9 ${amount.toFixed(2)}`;
}

function generateAndDownloadPDF(dc: DCBox) {
  try {
    const doc = new jsPDF();

    // Add the Noto Sans font to the PDF
    doc.addFont(NotoSansRegular, 'NotoSans', 'normal');
    doc.setFont('NotoSans');

    // Header
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text(dc.billType === 'E-way' ? 'E-way Bill Details' : 'DC Details', 105, 20, { align: 'center' });

    // Decorative line
    doc.setDrawColor(52, 152, 219);
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    // DC details
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94);

    const detailsStart = 40;
    const detailsGap = 10;

    function addDetail(label: string, value: string, index: number) {
      const y = detailsStart + (index * detailsGap);
      doc.setFontSize(12);
      doc.text(`${label}:`, 20, y);
      doc.setFontSize(11);
      doc.text(value, 70, y);
    }

    addDetail(`${dc.billType} Number`, dc.customName, 0);
    addDetail('POD Number', dc.trackingNo, 1);
    addDetail('Dispatched Date', dc.dispatchedDate, 2);
    addDetail('Delivery Date', dc.deliveryDate, 3);
    addDetail(`${dc.billType} Amount`, formatCurrencyForPDF(dc.dcAmount), 4);

    // Line items table
    const tableData = dc.lineItemIndices.map((itemIndex, i) => {
      const item = lineItemsWithStatus[itemIndex];
      return [
        (i + 1).toString(),
        item.name,
        `${item.quantity} ${item.unit}`,
        formatCurrencyForPDF(item.rate),
        formatCurrencyForPDF(item.item_total),
        item.status === 'need_to_purchase' ? 'Need to purchase locally' : 'Available'
      ];
    });

    (doc as any).autoTable({
      startY: detailsStart + (5 * detailsGap) + 10,
      head: [['No.', 'Item', 'Quantity', 'Rate', 'Amount', 'Status']],
      body: tableData,
      headStyles: { fillColor: [52, 152, 219], textColor: 255 },
      alternateRowStyles: { fillColor: [242, 242, 242] },
      styles: { font: 'NotoSans', fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 35 }
      },
    });

    // Save the PDF
    doc.save(`${dc.billType}_${dc.customName}.pdf`);
    console.log('PDF generated successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('An error occurred while generating the PDF. Please try again.');
  }
}

// Function to handle partial delivery toggle
function togglePartialDelivery() {
  userEnabledPartialDelivery = !userEnabledPartialDelivery;
}

// Function to save and go to next stage
async function saveAndGoToNextStage() {
  // Save the current state
  saveCurrentState();
  
  // Move to the next stage (Material to Procure)
  notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available');
  lineItemsWithStatus = [...lineItemsWithStatus];
  try {
      await fetch(`/submit-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: currentStage, 
        data: {
        lineItems: lineItemsWithStatus
      } })});
    }catch (error) {
      console.error('Error:', error);
    }
    goToNextStage();

    if (currentStage < stageData.length - 1) {
    do {
      currentStage++;
    } while (currentStage < stageData.length && !stageData[currentStage].visible);
  }
  try {
        await fetch('/update-current-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                SONumber: Stage0Data.SONumber, // Assuming SONumber is in Stage0Data
                currentStage: currentStage // Update to the next stage
            })
        });
    } catch (error) {
        console.error('Error updating current stage:', error);
    }

  
  await Swal.fire({
    title: 'Saved!',
    text: 'Moving to Material to Procure stage.',
    icon: 'success',
    confirmButtonText: 'OK'
  });
}

  // Function to open preview modal
  async function openPreviewModal(file: File | null, fileUrl: string | null) {
  const modal = document.getElementById('previewModal');
  const previewImage = document.getElementById('previewImage') as HTMLImageElement;
  const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement;
  
  if (modal && previewImage && previewIframe) {
    modal.style.display = 'block';
    const url = fileUrl || (file ? URL.createObjectURL(file) : null);
    
    if (!url) {
      await Swal.fire({
        title: 'Oops...',
        text: 'No file to preview',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (file?.type === 'application/pdf' || (fileUrl && fileUrl.endsWith('.pdf'))) {
      previewIframe.src = url;
      previewIframe.style.display = 'block';
      previewImage.style.display = 'none';
    } else if (file?.type.startsWith('image/') || (fileUrl && /\.(jpeg|jpg|gif|png)$/i.test(fileUrl))) {
      previewImage.src = url;
      previewImage.style.display = 'block';
      previewIframe.style.display = 'none';
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'Unsupported file type for preview',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      modal.style.display = 'none';
      return;
    }
  }
}
  function openPreviewModalDC(dcIndex: number): void {
    const dc = dcBoxes[dcIndex];
    if (dc && dc.attachment) {
      const modal = document.getElementById('previewModal');
      const previewImage = document.getElementById('previewImage') as HTMLImageElement | null;
      const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement | null;
      const previewLink = document.getElementById('previewLink') as HTMLAnchorElement | null; // For doc files
      
      if (modal && previewImage && previewIframe && previewLink) {
            modal.style.display = 'block';

            const reportName = dc.fileName.toLowerCase();
            let fileType = '';

            // Determine the file type based on the extension
            if (reportName.endsWith('.pdf')) {
                fileType = 'pdf';
            } else if (reportName.endsWith('.jpg') || reportName.endsWith('.jpeg')) {
                fileType = 'jpeg';
            } else if (reportName.endsWith('.png')) {
                fileType = 'png';
            } else if (reportName.endsWith('.doc') || reportName.endsWith('.docx')) {
                fileType = 'doc';
            }

            const base64Data = dc.attachment;
            
            if (fileType === 'pdf') {
                // Show PDF in iframe
                previewIframe.src = base64Data;
                previewIframe.style.display = 'block';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'jpeg' || fileType === 'png') {
                // Show image in img tag
                previewImage.src = base64Data;
                previewImage.style.display = 'block';
                previewIframe.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'doc' || fileType === 'docx') {
                // Provide a download link for DOC files
                previewLink.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Data}`;
                previewLink.download = Stage3Data.ReportName;
                previewLink.textContent = 'Download Document';
                previewLink.style.display = 'block';
                previewImage.style.display = 'none';
                previewIframe.style.display = 'none';
            } else {
                console.error('Unsupported file type');
                previewIframe.style.display = 'none';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            }
        } else {
            console.error('Modal or preview elements not found in the DOM.');
        }
    } else {
        console.error('No data found in DC.attachment');
    }
}


  // Function to close preview modal
  function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    const previewImage = document.getElementById('previewImage') as HTMLImageElement;
    const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement;
    if (modal) {
      modal.style.display = 'none';
    }
    if (previewImage) {
    previewImage.src = '';
  }
  
  if (previewIframe) {
    previewIframe.src = '';
  }
  }


 
  // For downloading from a URL (Stage 1)
  async function downloadFileFromUrl(url: string | null, fileName: string) {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'No file available for download',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      console.error('No file available for download');
    }
  }

  // Function to go to next page
  function goToNextPage() {
    if (currentStage < stageData.length - 1) {
      currentStage++;
    }
  }

  // Stage 2 related functions
  let showSaveButton = false;
let showLogisticsAlert = false;


function handleAvailabilityChange(itemId: string, newStatus: 'available' | 'need_to_purchase') {
  const item = notAvailableItems.find(item => item.Itemid === itemId);
  if (item) {
    if (newStatus === 'available') {
      item.isAvailable = true;
      item.needToPurchaseLocally = false;
    } else if (newStatus === 'need_to_purchase') {
      item.needToPurchaseLocally = true;
      item.isAvailable = false;
    }
    
    // Reset the serialNo and invoiceNo when changing status
    item.serialNo = '';
    item.invoiceNo = '';
    item.invoiceattachment = '';

    // Add the item to newlyAvailableItems
    if (!newlyAvailableItems.some(newItem => newItem.id === item.Itemid)) {
      newlyAvailableItems.push({
        id: item.Itemid,
        name: item.name,
        status: newStatus
      });
    }

    // Trigger reactivity
    notAvailableItems = notAvailableItems;
    newlyAvailableItems = newlyAvailableItems;
    showSaveButton = true;
    allItemsSaved = false;
  }
}

async function handleAttachmentChange(event: Event, itemId: string) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  
  if (file) {
    const item = notAvailableItems.find(item => item.Itemid === itemId);
    if (item) {
      try{
        const base64String = await convertFileToBase64(file);
        item.invoiceattachment = base64String;
      }catch (error) {
        console.error('Error converting file to base64:', error);
      }
      notAvailableItems = notAvailableItems; // Trigger reactivity
    }
  }
}

async function handleSaveMaterialToProcure() {
  try{
  loading.show('Saving material details...');  
  notAvailableItems = lineItemsWithStatus.filter(item => item.status === 'not_available')
  // const itemsToUpdate = notAvailableItems.filter(item => item.isAvailable || item.needToPurchaseLocally);
  const itemsToUpdate = lineItemsWithStatus.filter(item => item.status === 'not_available');

  if (itemsToUpdate.length === 0) {
    await Swal.fire('No changes to save.');
    return;
  }

  const invalidItems = itemsToUpdate.filter(item => !item.serialNo || !item.invoiceNo);
  if (invalidItems.length > 0) {
    await Swal.fire({
        title: 'Oops...',
        text: 'Please fill in both Serial No. and Invoice No. for all selected items.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    return;
  }

  const itemSummary = itemsToUpdate.map(item => 
    `${item.name}: ${item.isAvailable ? 'Available' : 'Need to purchase locally'}`
  ).join('\n');

  let confirm = false;

  await Swal.fire({
  title: "Are you sure you want to update the following items?",
  text: `${itemSummary}`,
  icon: "warning",
  showCancelButton: true,
  confirmButtonColor: "#3085d6",
  cancelButtonColor: "#d33",
  confirmButtonText: "Yes!"
}).then((result) => {
  if (result.isConfirmed) {
     confirm = true;
     Swal.fire({
      title: "Updated!",
      text: "Your Items has been updated.",
      icon: "success"
    });
  }
});

  if (confirm) {
    itemsToUpdate.forEach(item => {
      item.isAvailabilityFrozen = true;
      const index = lineItemsWithStatus.findIndex(lineItem => lineItem.Itemid === item.Itemid);
      if (index !== -1) {
        lineItemsWithStatus[index].status = item.isAvailable ? 'available' : 'need_to_purchase';
        lineItemsWithStatus[index].serialNo = item.serialNo;
        lineItemsWithStatus[index].invoiceNo = item.invoiceNo;
        lineItemsWithStatus[index].invoiceattachment = item.invoiceattachment;
      }
      
      if (!newlyAvailableItems.some(newItem => newItem.id === item.Itemid)) {
        newlyAvailableItems.push({
          id: item.Itemid,
          name: item.name,
          status: item.isAvailable ? 'available' : 'need_to_purchase'
        });
      }
    });
    
    notAvailableItems = notAvailableItems.filter(item => !item.isAvailable && !item.needToPurchaseLocally);
    showSaveButton = false;
    showLogisticsAlert = true;
    
    // Update the reactive variables
    lineItemsWithStatus = [...lineItemsWithStatus];
    notAvailableItems = [...notAvailableItems];
    newlyAvailableItems = [...newlyAvailableItems];

    try {
      await fetch(`/submit-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: currentStage, 
        data: {
        lineItems: lineItemsWithStatus
      } })});
    }catch (error) {
      console.error('Error:', error);
    }
    
    const availableItems = itemsToUpdate.filter(item => item.isAvailable).map(item => item.name);
    const purchaseLocallyItems = itemsToUpdate.filter(item => item.needToPurchaseLocally).map(item => item.name);
    
    let alertMessage = "";
    if (availableItems.length > 0) {
      alertMessage += `The following items are now available:\n${availableItems.join(", ")}\n\n`;
    }
    if (purchaseLocallyItems.length > 0) {
      alertMessage += `The following items need to be purchased locally:\n${purchaseLocallyItems.join(", ")}\n\n`;
    }
    alertMessage += "Please complete the order in the Logistics stage.";
    
    await Swal.fire(alertMessage);

    // Check if all items are saved
    allItemsSaved = notAvailableItems.length === 0;
  }
   stageData[currentStage].completed = true;
  // Automatically move to the next stage
    goToPreviousStage();
    if (currentStage < stageData.length - 1) {
    do {
      currentStage--;
    } while (currentStage < stageData.length && !stageData[currentStage].visible);
    }
    try {
        await fetch('/update-current-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                SONumber: Stage0Data.SONumber, // Assuming SONumber is in Stage0Data
                currentStage: currentStage // Update to the next stage
            })
        });
    } catch (error) {
        console.error('Error updating current stage:', error);
    }
}catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while saving. Please try again.',
            icon: 'error'
        });
    } finally {
        loading.hide();
    }
}

async function openPreviewModalMaterial(item: LineItem) {
  const modal = document.getElementById('previewModal');
  const previewImage = document.getElementById('previewImage') as HTMLImageElement;
  const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement;
  
  if (modal && previewImage && previewIframe && item.invoiceattachment) {
    modal.style.display = 'block';
    const fileUrl = URL.createObjectURL(item.invoiceattachment);
    if (item.invoiceattachment.type === 'application/pdf') {
      previewIframe.src = fileUrl;
      previewIframe.style.display = 'block';
      previewImage.style.display = 'none';
    } else if (item.invoiceattachment.type.startsWith('image/')) {
      previewImage.src = fileUrl;
      previewImage.style.display = 'block';
      previewIframe.style.display = 'none';
    } else {
      await Swal.fire('Unsupported file type for preview');
      modal.style.display = 'none';
      return;
    }
  }
}

  // Stage 3 related functions
  interface Shipment {
    // ... other properties ...
    installationFile?: File;
    installationFileName?: string;
    serviceFile?: File;
    serviceFileName?: string;
    // ... other properties ...
    // installationRemark: { content: string; timestamp: string }[];
  currentRemark: string;
  // serviceRemarks: { content: string; timestamp: string }[];
  // currentServiceRemark: string;
  
}


  let shipments: any[] = [{ isSaved: false, activeTab: 'installation', rejected: false, rejectionRemark: '',
     // Add these new properties
  // installationRemarks: [],
  currentRemark: '',
  // serviceRemarks: [],
  // currentServiceRemark: '',
  
  // Initialize other properties as needed
  installationFile: undefined,
  installationFileName: undefined,
  serviceFile: undefined,
  serviceFileName: undefined,
   }];

  function validateMobileNumber(number: string): boolean {
    const regex = /^\d{10}$/;
    return regex.test(number);
  }
  function handleMobileInput(event: Event) {
      const input = event.target as HTMLInputElement;
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
  }

  function editShipment(index: number) {
  shipments[index].isEditing = true;
  shipments = [...shipments]; // Trigger reactivity
}

function cancelEdit(index: number) {
  // Revert changes
  shipments[index] = { ...shipments[index], isEditing: false };
  // If you want to revert to the original data, you might need to keep a copy of the original data
  // and restore it here
  shipments = [...shipments]; // Trigger reactivity
}
let isSave3Disabled = false;
async function saveShipment(index: number) {
  const shipment = shipments[index];
  if (isShipmentValid(shipment)) {
    shipment.isSaved = true;
    shipment.isEditing = false;
    shipments = [...shipments];
    shipment.accountStatus = '';
    shipment.accountRemark = '';
    // alert(`${shipment.activeTab === 'installation' ? 'Installation' : 'Service'} details ${shipment.isEditing ? 'updated' : 'saved'} successfully.`);
    console.log('Saved shipment:', shipment);
    isSave3Disabled=true;
    // Update the Share with Account stage
    updateShareWithAccountStage();
  
    try {
      await fetch(`/submit-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: currentStage, 
        data: {Stage3Data} 
      })});
    }catch (error) {
      console.error('Error:', error);
    }
    shipment.isEditing = false;
    alert(`${Stage3Data.activeTab === 'installation' ? 'Installation' : 'Service'} details saved successfully.`);
    console.log('Saved shipment:', shipment); // Debug log
  } else {
    await Swal.fire({
        title: 'Oops...',
        text: `Please fill up all the ${Stage3Data.activeTab === 'installation' ? 'installation' : 'service'} details before saving.`,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    console.log('Invalid shipment:', shipment); // Debug log
  }
  lastSavedTimes[currentStage] = getCurrentDateTime();
}

function updateShareWithAccountStage() {
  // This function will update the Share with Account stage
  // It will be called whenever a shipment is saved in the Ongoing stage
  // stageData[stageData[4].visible ? 5 : 4].visible = true;
  const shareWithAccountStageIndex = stageData.findIndex(stage => stage.title === "Share with Account");
  if (shareWithAccountStageIndex !== -1) {
    stageData[shareWithAccountStageIndex].visible = true;
    stageData = [...stageData]; // Trigger reactivity
  }
}

  function isShipmentValid(shipment: any): boolean {
    if (shipment.activeTab === 'installation') {  
      return Boolean(Stage3Data.engName && Stage3Data.ScheduleDate && 
             Stage3Data.MobNo && Stage3Data.MobNo.length === 10 &&
             Stage3Data.VendorName  && Stage3Data.Report);
    } else {
      return Boolean( Stage3Data.engName && Stage3Data.ScheduleDate && 
             Stage3Data.MobNo && Stage3Data.MobNo.length === 10 &&
             Stage3Data.VendorName && Stage3Data.Remark && Stage3Data.Report && Stage3Data.Ticketid);
    }
  }

  async function handleStage3FileChange(event: Event, type: 'installation' | 'service', index: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
      if (file && (!shipments[index].isSaved || shipments[index].isEditing)) {
        showCustomNameModal = true;
        const extension = file.name.split('.').pop() || '';
        customFileName = file.name.replace(`.${extension}`, '');
        customFileExtension = extension;
        try {
          const base64String = await convertFileToBase64(file);
            Stage3Data.Report = base64String;
            Stage3Data.ReportName = file.name;
            Stage3Data.PreviewUrl= URL.createObjectURL(file);
            shipments = [...shipments]; // Trigger reactivity
        }catch (error) {
          console.error('Error converting file to base64:', error);}
    } lastSavedTimes[currentStage] = getCurrentDateTime();
  }

  function saveRemark(index: number) {
  const shipment = shipments[index];
  if (shipment.currentRemark.trim()) {
    Stage3Data.Remark.push({
      content: shipment.currentRemark.trim(),
      timestamp: new Date().toLocaleString()
    });
    shipment.currentRemark = '';
    Stage3Data = {...Stage3Data};
    shipments = [...shipments]; // Trigger reactivity
  }
}

// function saveServiceRemark(index: number) {
//   const shipment = shipments[index];
//   if (shipment.currentServiceRemark.trim()) {
//     Stage3Data.Remark.push({
//       content: shipment.currentServiceRemark.trim(),
//       timestamp: new Date().toLocaleString()
//     });
//     shipment.currentServiceRemark = '';
//     Stage3Data = [...Stage3Data];
//     shipments = [...shipments]; // Trigger reactivity
//   }
// }

  function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
 }

 function convertBase64ToFile(base64String: string, fileName: string, mimeType: string): File {
  // Extract the base64 data (remove the data URL prefix if present)
  const base64Data = base64String.split(',')[1] || base64String;
  
  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create a Blob from the binary data
  const blob = new Blob([bytes], { type: mimeType });
  
  // Create a File from the Blob
  return new File([blob], fileName, { type: mimeType });
}


function previewFile() {
    if (Stage3Data.Report) {
        const modal = document.getElementById('previewModal');
        const previewImage = document.getElementById('previewImage') as HTMLImageElement | null;
        const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement | null;
        const previewLink = document.getElementById('previewLink') as HTMLAnchorElement | null; // For doc files

        if (modal && previewImage && previewIframe && previewLink) {
            modal.style.display = 'block';

            const reportName = Stage3Data.ReportName.toLowerCase();
            let fileType = '';

            // Determine the file type based on the extension
            if (reportName.endsWith('.pdf')) {
                fileType = 'pdf';
            } else if (reportName.endsWith('.jpg') || reportName.endsWith('.jpeg')) {
                fileType = 'jpeg';
            } else if (reportName.endsWith('.png')) {
                fileType = 'png';
            } else if (reportName.endsWith('.doc') || reportName.endsWith('.docx')) {
                fileType = 'doc';
            }

            const base64Data = Stage3Data.Report;
            
            if (fileType === 'pdf') {
                // Show PDF in iframe
                previewIframe.src = Stage3Data.Report;
                previewIframe.style.display = 'block';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'jpeg' || fileType === 'png') {
                // Show image in img tag
                previewImage.src = Stage3Data.Report;
                previewImage.style.display = 'block';
                previewIframe.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'doc' || fileType === 'docx') {
                // Provide a download link for DOC files
                previewLink.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Data}`;
                previewLink.download = Stage3Data.ReportName;
                previewLink.textContent = 'Download Document';
                previewLink.style.display = 'block';
                previewImage.style.display = 'none';
                previewIframe.style.display = 'none';
            } else {
                console.error('Unsupported file type');
                previewIframe.style.display = 'none';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            }
        } else {
            console.error('Modal or preview elements not found in the DOM.');
        }
    } else {
        console.error('No data found in Stage3Data.Report.');
    }
}


async function downloadFile(base64DataWithPrefix: string | null, fileName: string) {
  if (base64DataWithPrefix) {
    // Extract the base64 content and the MIME type from the data URL prefix
    const [prefix, base64Data] = base64DataWithPrefix.split(',');
    let mimeType = '';
    
    // Determine the MIME type from the prefix
    if (prefix.includes('pdf')) {
      mimeType = 'application/pdf';
    } else if (prefix.includes('jpeg')) {
      mimeType = 'image/jpeg';
    } else if (prefix.includes('png')) {
      mimeType = 'image/png';
    } else if (prefix.includes('wordprocessingml.document')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      mimeType = 'application/octet-stream'; // Default binary type
    }

    // Create a Blob from the base64 data
    const byteCharacters = atob(base64Data); // Decode the base64 data
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Create a download link and trigger the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();

    // Clean up the URL and remove the anchor element
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    await Swal.fire({
      title: 'Oops...',
      text: 'No file available for download',
      icon: 'warning',
      confirmButtonText: 'OK'
    });
    console.error('No file available for download');
  }
}



let returnPickup = {
    name: '',
    mobile: '',
    remark: '',
    file: null as File | any,
    fileName: '',
    status: '',
    validateData: '',
    validatedData: '',
    filePreviewUrl: null as string | null,
    isSaved: false,
    isDataSaved: false,
    rejected: false,
    rejectionRemark: '',
    accountStatus: '',
    accountRemark: '',
    isEditing: false,
    dcNumber: '',
    trackingNo: '',
    dcAmount: '',
    dispatchedDate: '',
    deliveryDate: '',
    dcaccountRemark: '',
    selectedItems: []  as LineItem[],
    approved: false,
    approvalRemark: '',
  };

  let showReturnPickupConfirmation = false;
  let showConfirmationPopup = false;
  let returnPickupDetailsSaved = false;
  let returnPickupName = '';
  let returnPickupMobile = '';
  let returnPickupRemark = '';

  function toggleReturnPickup() {
    if (Stage4Data.returnPickupRequested && !returnPickupDetailsSaved) {
      // If cancelling and details are not saved, reset the state
      Stage4Data.returnPickupRequested = false;
      returnPickupName = '';
      returnPickupMobile = '';
      returnPickupRemark = '';
    } else if (!Stage4Data.returnPickupRequested) {
      // If requesting, show the details form
      Stage4Data.returnPickupRequested = true;
    }
}

async function saveReturnPickupDetails() {
  if (Stage4Data.ReturnPickupName && Stage4Data.ReturnPickupMobile.length === 10 && Stage4Data.ReturnPickupRemark) {
    const selectedItems = lineItemsWithStatus.filter(item => item.returnPickup);
    if (selectedItems.length > 0) {
      showReturnPickupConfirmation = true;
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please select at least one item for return pickup.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  } else {
    await Swal.fire({
        title: 'Oops...',
        text: 'Please fill in all fields correctly before saving.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
  }
}

async function editQuantity(item: LineItem) {
  const { value: newQuantity } = await Swal.fire({
    title: `Enter new quantity for ${item.name}:`,
    input: 'number',
    inputValue: item.returnQuantity?.toString() ?? item.quantity.toString(),
    inputAttributes: {
      min: '1',
      step: '1'
    },
    showCancelButton: true,
    confirmButtonText: 'Update',
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        return 'Please enter a valid quantity!';
      }
    }
  });

  if (newQuantity) {
    const quantity = parseFloat(newQuantity);
    if (!isNaN(quantity) && quantity > 0) {
      item.returnQuantity = quantity;
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please enter a valid quantity.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  }
}
async function confirmReturnPickup() {
  showReturnPickupConfirmation = false;
  returnPickupDetailsSaved = true;
  returnPickup.selectedItems = lineItemsWithStatus
    .filter(item => item.returnPickup)
    .map(item => ({
      ...item,
      quantity: item.returnQuantity ?? item.quantity,
      item_total: (item.returnQuantity ?? item.quantity) * item.rate
    }));
  try {
    await fetch(`/submit-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: currentStage, data: Stage4Data })});
    await Swal.fire({
        title: 'Success',
        text: 'Return Pickup request confirmed. Details have been saved and can no longer be edited.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
  }
  catch (error) {
    console.error('Error:', error);
  }
}

function previewReturnPickupFile() {
  if (Stage4Data.Attachment) {
        const modal = document.getElementById('previewModal');
        const previewImage = document.getElementById('previewImage') as HTMLImageElement | null;
        const previewIframe = document.getElementById('previewIframe') as HTMLIFrameElement | null;
        const previewLink = document.getElementById('previewLink') as HTMLAnchorElement | null; // For doc files

        if (modal && previewImage && previewIframe && previewLink) {
            modal.style.display = 'block';

            const reportName = Stage4Data.fileName.toLowerCase();
            let fileType = '';

            // Determine the file type based on the extension
            if (reportName.endsWith('.pdf')) {
                fileType = 'pdf';
            } else if (reportName.endsWith('.jpg') || reportName.endsWith('.jpeg')) {
                fileType = 'jpeg';
            } else if (reportName.endsWith('.png')) {
                fileType = 'png';
            } else if (reportName.endsWith('.doc') || reportName.endsWith('.docx')) {
                fileType = 'doc';
            }
            
            if (fileType === 'pdf') {
                // Show PDF in iframe
                previewIframe.src = Stage4Data.Attachment;
                previewIframe.style.display = 'block';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'jpeg' || fileType === 'png') {
                // Show image in img tag
                previewImage.src = Stage4Data.Attachment;
                previewImage.style.display = 'block';
                previewIframe.style.display = 'none';
                previewLink.style.display = 'none';
            } else if (fileType === 'doc' || fileType === 'docx') {
                // Provide a download link for DOC files
                previewLink.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Data}`;
                previewLink.download = Stage4Data.fileName;
                previewLink.textContent = 'Download Document';
                previewLink.style.display = 'block';
                previewImage.style.display = 'none';
                previewIframe.style.display = 'none';
            } else {
                console.error('Unsupported file type');
                previewIframe.style.display = 'none';
                previewImage.style.display = 'none';
                previewLink.style.display = 'none';
            }
        } else {
            console.error('Modal or preview elements not found in the DOM.');
        }
    } else {
        console.error('No data found in Stage4Data.Attachment.');
    }
}

function handleReturnPickupMobileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  input.value = input.value.replace(/\D/g, '').slice(0, 10);
}

  async function handleReturnPickupFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  
  if (file && !returnPickup.isSaved) {
    showCustomNameModal = true;
    const extension = file.name.split('.').pop() || '';
    customFileName = file.name.replace(`.${extension}`, '');
    customFileExtension = extension;
    try {
      const base64String = await convertFileToBase64(file);
      Stage4Data.Attachment= base64String;
      Stage4Data.fileName = file.name;
      returnPickup = {...returnPickup}; // Trigger reactivity
    }catch (error) {
      console.error('Error converting file to base64:', error);
    }
    }
    lastSavedTimes[currentStage] = getCurrentDateTime();
  }

async function saveReturnPickup() {
    if (isReturnPickupComplete()) {
      returnPickup.isSaved = true;
      returnPickup.isDataSaved = true;
      await Swal.fire({
        title: 'Success',
        text: 'Return Pickup details saved successfully. You can no longer edit this entry.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
    } else {
      await Swal.fire({
        title: 'Oops...',
        text: 'Please fill up all the Return Pickup details.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
    }
  }

  function isReturnPickupComplete(): boolean {
    return (
      Stage4Data.ReturnPickupName.trim() !== '' &&
      Stage4Data.ReturnPickupMobile.length === 10 &&
      Stage4Data.ReturnPickupRemark.trim() !== '' &&
      Stage4Data.Attachment !== null &&
      Stage4Data.DCNumber.trim() !== '' &&
      Stage4Data.CourierTrackNo.trim() !== '' &&
      Stage4Data.DCAmount !== null &&
      Stage4Data.DispatchDate !== '' &&
      Stage4Data.DeliveryDate !== '' &&
      Stage4Data.Remark.trim() !== ''
    );
  }

  function formatAmountreturn(event: Event) {
  const input = event.target as HTMLInputElement;
  let value = input.value.replace(/[^\d.]/g, '');  // Remove any non-numeric characters except the decimal point
  
  // Allow only one decimal point
  const parts = value.split('.');
  if (parts.length > 2) {
    parts.pop();
    value = parts.join('.');
  }
  
  // Format with commas for thousands
  const [wholePart, decimalPart] = value.split('.');
  let formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  // Combine whole part and decimal part (if exists)
  let formatted = formattedWholePart;
  if (decimalPart !== undefined) {
    formatted += '.' + decimalPart;
  }

  // Update the input value (with commas) for display
  input.value = formatted;

  // Remove commas and convert the formatted string to a float
  Stage4Data.DCAmount = parseFloat(value.replace(/,/g, ''));

  // You can log to verify
  console.log("DC Amount as float:", Stage4Data.DCAmount);
}


let stageStartTimes: { [key: number]: string } = {};
let lastSavedTimes: { [key: number]: string } = {};
let lastSubmittedTimes: { [key: number]: string } = {};

function getCurrentDateTime(): string {
  return new Date().toLocaleString();
}

function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

function updateDeliveryDateMin() {
    if (returnPickup.dispatchedDate > returnPickup.deliveryDate) {
      returnPickup.deliveryDate = returnPickup.dispatchedDate;
    }
}

  // Share with account related variables
  let accountStatus = '';
  let accountRemark = '';
  let showRejectionAlert = false;
  let canEditOngoing = false;
  let canEditReturnPickup = false;

  function handleKeydown(event: { key: string; }) {
  if (event.key === 'Enter' || event.key === ' ') {
    closePreviewModal();
  }
}

  // Reactive statements
  $: {
    stageData[4].visible = Stage4Data.returnPickupRequested;
    stageData = stageData; // Trigger reactivity
  }

  $: {
    partialDelivery = lineItemsWithStatus.some(item => item.status === 'not_available');
    updateDCOrderTotal();
  }

  $: {
    if (showRejectionAlert) {
      canEditOngoing = true;
      canEditReturnPickup = true;
    }
  }

$: {
  stageData[2].visible = lineItemsWithStatus.some(item => item.status === 'not_available');
}
$: allItemsNotAvailable = lineItemsWithStatus.every(item => item.status === 'not_available');
$: allItemsNotAvailableOrNotRequired = lineItemsWithStatus.every(item => 
  item.status === 'not_available' || item.status === 'not_required'
);

$: canSubmitLogistics = allLineItemsFrozen() && allStatusesFilled && dcBoxes.every(dc => dc.isSaved || isCurrentDCFilled());

$: visibleStages = (isDropped || isMonitoring) 
    ? stageData.filter(stage => stage.completed)
    : stageData;

  $: anyItemNotAvailable = lineItemsWithStatus.some(item => item.status === 'not_available');

$: allItemsAvailableOrPurchaseOrNotRequired = lineItemsWithStatus.every(item => 
  item.status === 'available' || item.status === 'need_to_purchase' || item.status === 'not_required'
);

$: showDCBoxDetails = (allItemsAvailableOrPurchaseOrNotRequired && !anyItemNotAvailable) || 
                      (partialDelivery && userEnabledPartialDelivery && anyItemNotAvailable);

$: canAddMoreDC = lineItemsWithStatus.some(item => item.status === 'available' || item.status === 'need_to_purchase');


    let showDetailsModal = false;
    let selectedDC: DCBox | null = null;

    async function validationSHUBHAMDC() {

    if (!Stage4Data.DCNumber) {
      await Swal.fire({
        title: 'Oops..',
        text: 'Please enter a DC number first.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      const response = await fetch(`/api/validate-dc?dc_number=${encodeURIComponent(Stage4Data.DCNumber)}`);
      const data = await response.json();

      if (data.error) {
        await Swal.fire({
          title: 'Error',
          text: data.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }

      if (data.deliverychallans && data.deliverychallans.length > 0) {
        const challan = data.deliverychallans[0];
        Stage4Data.status = challan.status.toLowerCase();
        Stage4Data.validatedData = challan;
        await Swal.fire({
          title: 'Success',
          text: 'DC validated successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        await Swal.fire({
          title: 'Not Found',
          text: 'No matching DC found.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error("Error validating DC:", error);
      await Swal.fire({
        title: 'Error',
        text: 'An error occurred while validating the DC number.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }
  
  async function validateDC(dcIndex: number) {
    try{
      loading.show('Validating DC...');
    const dc = dcBoxes[dcIndex];
    if (!dc.DCNumber) {
      await Swal.fire({
        title: 'Oops..',
        text: 'Please enter a DC number first.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      const response = await fetch(`/api/validate-dc?dc_number=${encodeURIComponent(dc.DCNumber)}`);
      const data = await response.json();

      if (data.error) {
        await Swal.fire({
          title: 'Error',
          text: data.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }

      if (data.deliverychallans && data.deliverychallans.length > 0) {
        const challan = data.deliverychallans[0];
        dc.status = challan.status.toLowerCase();
        dc.validatedData = challan;
        await Swal.fire({
          title: 'Success',
          text: 'DC validated successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        await Swal.fire({
          title: 'Not Found',
          text: 'No matching DC found.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error("Error validating DC:", error);
      await Swal.fire({
        title: 'Error',
        text: 'An error occurred while validating the DC number.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }

    dcBoxes = [...dcBoxes]; // Trigger reactivity
  }catch (error) {
        console.error('Error validating DC:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while validating the DC number.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    } finally {
        loading.hide();
    }
}

  async function showDCDetails(dcIndex: number) {
    selectedDC = dcBoxes[dcIndex];
    if (selectedDC.validatedData) {
      showDetailsModal = true;
    } else {
      await Swal.fire({
        title: 'No Data',
        text: 'No validated data available. Please validate the DC first.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
    }
  }

  async function showDCshubhamDetails() {
    if (Stage4Data.validatedData) {
      showDetailsModal = true;
    } else {
      await Swal.fire({
        title: 'No Data',
        text: 'No validated data available. Please validate the DC first.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
    }
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    selectedDC = null;
  }
  export let index: number;
    let inputRef: HTMLInputElement;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      validateDC(index);
    }
  }

  function handleFocus() {
    setBillType(index);
    isHovered = true;
  }

  function handleBlur() {
    isHovered = false;
  }

    let isValidating = false;
  let validationStatus: 'success' | 'error' | 'notFound' | null = null;

  async function validationDC() {
    if (!Stage4Data.DCNumber) {
      await Swal.fire({
        title: 'Oops..',
        text: 'Please enter a DC number first.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    isValidating = true;
    try {
      const response = await fetch(`/api/validate-dc?dc_number=${encodeURIComponent(Stage4Data.DCNumber)}`);
      const data = await response.json();

      if (data.error) {
        validationStatus = 'error';
        await Swal.fire({
          title: 'Error',
          text: data.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }

      if (data.deliverychallans && data.deliverychallans.length > 0) {
        const challan = data.deliverychallans[0];
        returnPickup = {
          ...returnPickup,
          status: challan.status.toLowerCase(),
          validatedData: challan
        };
        dispatch('update', returnPickup);
        validationStatus = 'success';
        await Swal.fire({
          title: 'Success',
          text: 'DC validated successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        validationStatus = 'notFound';
        await Swal.fire({
          title: 'Not Found',
          text: 'No matching DC found.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error("Error validating DC:", error);
      validationStatus = 'error';
      await Swal.fire({
        title: 'Error',
        text: 'An error occurred while validating the DC number.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      isValidating = false;
    }
  }
async function fetchPreviousStagesData() {
  try {
    loading.show('Fetching previous stages data...');
    const response = await fetch(`/fetch-previous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStage, salesOrder}),
    });

    const result = await response.json();

    if (result.success) {
      const { stage0Fetched, stage1Fetched, stage3Fetched } = fillPreviousStagesData(result.previousStagesData);
      console.log("fucking fetch---", Stage3Data);
      
    }
  }catch (error) {
        console.error('Error fetching previous stages data:', error);
        await Swal.fire({
            title: 'Error',
            text: 'An error occurred while fetching data. Please try again.',
            icon: 'error'
        });
    } finally {
        loading.hide();
    }
}
function fillPreviousStagesData(data: any): { stage0Fetched: boolean, stage1Fetched: boolean, stage3Fetched: boolean } {
  console.log("fetched data-", data);
  let stage0Fetched = false;
  let stage1Fetched = false;
  let stage3Fetched = false;
  let stage4Fetched = false;

  if (data.stage0) {
    Stage0Data = { ...data.stage0 };
    Stage0Data.clientExpectedDate = new Date(Stage0Data.clientExpectedDate).toISOString().split('T')[0];
    stage0Fetched = true;
  }
  if (data.stage1) {
    if (data.stage1.lineItems && data.stage1.lineItems.length > 0) {
      lineItemsWithStatus = data.stage1.lineItems.map((item: LineItem) => ({
        ...item,
        isAvailabilityFrozen: item.isAvailabilityFrozen || false,
        needToPurchaseLocally: item.needToPurchaseLocally || false,
        isAvailable: item.isAvailable || false,
      }));
      console.log("Items func", lineItemsWithStatus);
    }

    if (data.stage1.dcBoxes && data.stage1.dcBoxes.length > 0) {
      dcBoxes = data.stage1.dcBoxes.map((box: DCBox) => ({
        ...box,
        filePreviewUrl: box.filePreviewUrl || null,
        billType: box.billType || 'DC',
        isTypeSet: box.isTypeSet || false,
        DispatchDate : new Date(box.DispatchDate).toISOString().split('T')[0],
        EstdDeliveryDate : new Date(box.EstdDeliveryDate).toISOString().split('T')[0],
      }));
    }
    stage1Fetched = true;
  }

  if (data.stage3) {
    
    if (data.stage3.installation != null) {
      Stage3Data = {}; 
      Stage3Data.SONumber = data.stage3.installation.SONumber;
      Stage3Data.engName = data.stage3.installation.engName;
      Stage3Data.MobNo = data.stage3.installation.MobNo;
      Stage3Data.VendorName = data.stage3.installation.VendorName;
      Stage3Data.Remark = data.stage3.installation.InstallationRem;
      Stage3Data.Report = data.stage3.installation.InstReport;
      Stage3Data.Ticketid = '';
      Stage3Data.ScheduleDate=new Date(data.stage3.installation.ScheduleDate).toISOString().split('T')[0];
      Stage3Data.activeTab=data.stage3.installation.activeTab;
      Stage3Data.ReportName=data.stage3.installation.InstReportName;
      Stage3Data.PreviewUrl=data.stage3.installation.InstPreviewUrl;
    }
    if (data.stage3.service != null) {
      Stage3Data = {}; 
      Stage3Data.SONumber = data.stage3.service.SONumber;
      Stage3Data.engName = data.stage3.service.engName;
      Stage3Data.MobNo = data.stage3.service.MobNo;
      Stage3Data.VendorName = data.stage3.service.VendorName;
      Stage3Data.Remark = data.stage3.service.ServiceRem;
      Stage3Data.Report = data.stage3.service.ServiceReport;
      Stage3Data.Ticketid = data.stage3.service.Serticketid;
      Stage3Data.ScheduleDate=new Date(data.stage3.service.ScheduleDate).toISOString().split('T')[0];
      Stage3Data.activeTab=data.stage3.service.activeTab;
      Stage3Data.ReportName=data.stage3.service.ServiceReportName;
    }
    if(data.stage3.stage4Data){
      Stage4Data.SONumber = data.stage3.stage4Data.SONumber;
      Stage4Data.returnPickupRequested = data.stage3.stage4Data.returnPickupRequested;
      Stage4Data.ReturnPickupName = data.stage3.stage4Data.ReturnPickupName;
      Stage4Data.ReturnPickupMobile = data.stage3.stage4Data.ReturnPickupMobile;
      Stage4Data.ReturnPickupRemark = data.stage3.stage4Data.ReturnPickupRemark;
    }
    stage3Fetched = true;
  }
  if(data.stage4){
    Stage4Data.DCNumber = data.stage4.DCNumber;
    Stage4Data.CourierTrackNo=data.stage4.CourierTrackNo;
    Stage4Data.DCAmount=data.stage4.DCAmount;
    Stage4Data.DispatchDate=new Date(data.stage4.DispatchDate).toISOString().split('T')[0];
    Stage4Data.DeliveryDate=new Date(data.stage4.DeliveryDate).toISOString().split('T')[0];
    Stage4Data.Remark=data.stage4.Remark;
    Stage4Data.Attachment=data.stage4.Attachment;
    Stage4Data.fileName=data.stage4.fileName;
  }
  stage4Fetched = true;

  if(data.stage5){
    Stage5Data.accStatus = data.stage5.accStatus;
    Stage5Data.rejected1 = data.stage5.rejected1;
    Stage5Data.accRemark = data.stage5.accRemark;
    Stage5Data.retaccStatus = data.stage5.retaccStatus;
    Stage5Data.rejected2 = data.stage5.rejected2;
    Stage5Data.retaccRemark = data.stage5.retaccRemark;
    Stage5Data.isDataSaved1 = data.stage5.isDataSaved1;
    Stage5Data.isEditing1 = data.stage5.isEditing1;
    Stage5Data.isDataSaved2 = data.stage5.isDataSaved2;
    Stage5Data.isEditing2 = data.stage5.isEditing2;
  }

  return { stage0Fetched, stage1Fetched, stage3Fetched };
}


</script>


<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" 
     on:click|self={closeModal}
     on:keydown={(e) => e.key === 'Escape' && closeModal()}
     role="button"
     tabindex="0">
  <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-slate-100">

    <div class="mb-8">
      <div class="relative flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Stages</h2>
      <div class="relative" bind:this={dropdownContainer}>
        <button 
          class="text-2xl font-bold focus:outline-none text-gray-600 hover:text-gray-800 transition-colors duration-200"
          on:click={toggleDropdown}
        >
          ⋮
        </button>
        {#if showDropdown}
        <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 overflow-hidden">
            <button 
              class="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              on:click={handleDroppedToggle}
            >
              Dropped (Void)
            </button>
            <button 
              class="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              on:click={handleMonitoringToggle}
            >
              Monitoring Billing
            </button>
          </div>
        {/if}
      </div>
    </div>
    
    {#if isDropped || isMonitoring}
    <div class="status-box bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8 text-center font-medium text-lg shadow-sm">
      <p class="text-yellow-800">{isDropped ? "SO is Void" : "Bill is getting Monitored"}</p>
      <p class="mt-2 text-sm text-yellow-700">{isDropped ? droppedRemarks : monitoringRemarks}</p>
    </div>
    {/if}    

    <!-- Progress bar -->
  <div class="relative mb-6">
    <div class="overflow-hidden h-2 text-xs flex rounded bg-blue-100">
      <div
        style="width: {(visibleStages.filter(stage => stage.completed).length / visibleStages.length) * 100}%"
        class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-in-out"
      ></div>
    </div>
  </div>
    
    <!-- Stage navigation -->
    <div class="flex justify-between items-center">
      {#each visibleStages as stage, index}
        {#if stage.visible !== false}
        <div class="flex flex-col items-center group">
          <button
          class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out {
            stage.completed ? 'bg-blue-500 text-white' : 
            currentStage === index ? 'bg-white border-2 border-blue-500 text-blue-500' : 'bg-white border-2 border-gray-300 text-gray-400'
          } hover:bg-blue-100 hover:border-blue-500 hover:text-blue-500 focus:outline-none shadow-md group-hover:shadow-lg"
          on:click={() => moveStage = index}
          disabled={index > currentStage}
          >
            {index}
          </button>
          <span class="mt-2 text-xs font-medium text-gray-600 group-hover:text-blue-500 transition-colors duration-200">{stage.title}</span>
        </div>
        {/if}
      {/each}
    </div>
  </div>
<style>
      @media (max-width: 640px) {
      .flex.justify-between {
        flex-wrap: wrap;
      }
      .flex.justify-between > div {
        flex: 0 0 33.333%;
        margin-bottom: 1rem;
      }
    }
</style>

    {#if showDroppedPopup}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold mb-4">Dropped (Void)</h2>
        <label class="block mb-4">
          <span class="text-gray-700">Remarks:</span>
          <textarea
            bind:value={droppedRemarks}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            rows="3"
          ></textarea>
        </label>
        <div class="flex justify-end">
          <button
            on:click={() => showDroppedPopup = false}
            class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            on:click={submitDropped}
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={!droppedRemarks.trim()}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
    {/if}
    
    {#if showMonitoringPopup}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold mb-4">Monitoring Billing</h2>
        <label class="block mb-4">
          <span class="text-gray-700">Remarks:</span>
          <textarea
            bind:value={monitoringRemarks}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            rows="3"
          ></textarea>
        </label>
        <div class="flex justify-end">
          <button
            on:click={() => showMonitoringPopup = false}
            class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            on:click={submitMonitoring}
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={!monitoringRemarks.trim()}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
    {/if}

    <LoadingOverlay />

    <form on:submit={handleSubmit}>
      <div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl border border-gray-200">
        <h3 class="text-2xl font-bold mb-6 text-gray-800 border-b pb-2 transition-colors duration-200">{stageData[moveStage].title}</h3>

      {#if moveStage === 0}
        <!-- API data fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-fadeIn">
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="so_number">
              SO Number
            </label>
            <input id="so_number" type="text" value={salesOrder.salesorder_number} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="so_date">
              SO Date
            </label>
            <input id="so_date" type="text" value={new Date(salesOrder.date).toLocaleDateString()} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="client_name">
              Client Name
            </label>
            <input id="client_name" type="text" value={salesOrder.customer_name} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="purchase_order">
              Purchase Order
            </label>
            <input id="purchase_order" type="text" value={salesOrder.reference_number} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="so_subtotal">
              SO Subtotal
            </label>
            <input id="so_subtotal" type="text" value={formatCurrency(salesOrder.sub_total)} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="so_total">
              SO Total
            </label>
            <input id="so_total" type="text" value={formatCurrency(salesOrder.total)} readonly class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
          </div>
        </div>

        <!-- Stage-specific fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-fadeIn">
          <div class="transform hover:scale-105 transition-transform duration-200">
            <label class="block text-gray-700 text-sm font-semibold mb-2" for="so_category">
        SO Category
      </label>
      <input
        id="so_category" 
        value={salesOrder.custom_field_hash.cf_so_cat} 
        class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
        disabled
      >
    
    </div>
    <div class="transform hover:scale-105 transition-transform duration-200">
      <label class="block text-gray-700 text-sm font-semibold mb-2" for="project_manager">
        Project Manager Name
      </label>
      <input 
        id="project_manager" 
        value={salesOrder.custom_field_hash.cf_project_manager_name} 
        class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
        disabled
      >
    </div>
    <div class="transform hover:scale-105 transition-transform duration-200">
      <label class="block text-gray-700 text-sm font-semibold mb-2" for="client_expected_date">
        Client Expected Date of Handover *
      </label>
      <input 
        type="date" 
        id="client_expected_date" 
        bind:value={Stage0Data.clientExpectedDate} 
        min={minDate}
        class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
        disabled={!isEditing} 
        required
      >
    </div>
    
  </div>
  <style>
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  
    .animate-fadeIn {
      animation: fadeIn 0.5s ease-out;
    }
</style>
  
        
        {:else if moveStage === 1}
          <!-- Logistics stage content -->
          {#if showLogisticsAlert}
          <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-r-lg shadow-md relative" role="alert">
            <h4 class="font-bold text-lg mb-2">New Item Statuses</h4>
            {#if newlyAvailableItems.some(item => item.status === 'available')}
            <div class="mb-3">
            <p class="font-semibold">Available Items:</p>
            <ul class="list-disc list-inside mt-1 pl-4">
        {#each newlyAvailableItems.filter(item => item.status === 'available') as item}
          <li>{item.name}</li>
              {/each}
            </ul>
        </div>
            {/if}
    
            {#if newlyAvailableItems.some(item => item.status === 'need_to_purchase')}
            <div class="mb-3">
              <p class="font-semibold">Need to Purchase Locally:</p>
              <ul class="list-disc list-inside mt-1 pl-4">
                {#each newlyAvailableItems.filter(item => item.status === 'need_to_purchase') as item}
                  <li>{item.name}</li>
                {/each}
              </ul>
            </div>
            {/if}
            <p class="mt-2 font-medium">Please complete the order for these items in the Logistics stage.</p>
            <button 
              class="absolute top-2 right-2 text-yellow-700 hover:text-yellow-900 transition-colors duration-200"
              on:click={() => {
                showLogisticsAlert = false;
                newlyAvailableItems = [];
              }}
            >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
          </div>
        {/if}
          <div class="mb-8">
            <h4 class="text-xl font-bold mb-4">Line Items</h4>
            <div class="overflow-x-auto shadow-md rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each lineItemsWithStatus as item, index (item.Itemid)}
                    <tr class="hover:bg-gray-50 transition-colors duration-200">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity} {item.unit}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.rate)}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.amount)}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select bind:value={lineItemsWithStatus[index].status} 
                        on:change={() => handleStatusChange(index, lineItemsWithStatus[index].status)}
                        class="w-max px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200" disabled={frozenLineItems[item.Itemid] || !isEditing} >
                          <option value="">Select status</option>
                          <option value="available">Available</option>
                          <option value="not_available">Not Available</option>
                          <option value="need_to_purchase">Need to purchase locally</option>
                          <option value="not_required">Not Required</option>
                        </select>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
          {#if lineItemsWithStatus.length > 0}
    <button 
        class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        on:click={() => {
            localStorage.removeItem(STORAGE_KEY);
            lineItemsWithStatus = lineItemsWithStatus.map(item => ({
                ...item,
                status: ''
            }));
        }}
    >
        Reset All Statuses
    </button>
{/if}
          <!-- New reactive statement to check if all items are Not Available or Not Required -->
  
       <!-- Partial Delivery toggle -->
 {#if anyItemNotAvailable}
  <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
    <label class="inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        bind:checked={userEnabledPartialDelivery} 
        class="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
      >
      <span class="ml-2 text-gray-700 font-medium">Enable Partial Delivery</span>
    </label>
    <p class="mt-2 text-sm text-gray-600">
      Check this option to allow partial delivery of available items.
    </p>
  </div>
{/if}


<!-- DC Order Total section -->
<div class="mt-8 bg-gray-100 rounded-lg p-6">
  <h3 class="text-xl font-bold mb-4 text-gray-800">Order Summary</h3>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
  <div class="flex-1">
    <h4 class="text-lg font-semibold text-gray-700 mb-1">Current Unsaved Total:</h4>
    <p class="text-2xl font-bold text-blue-600">{formatCurrency(dcOrderTotal.subtotal)}</p>
  </div>
  <div class="hidden sm:block w-px h-16 bg-gray-300 mx-4"></div>
    <div class="flex-1 sm:text-right">
      <h4 class="text-lg font-semibold text-gray-700 mb-1">Total of Saved DCs or E-ways:</h4>
      <p class="text-2xl font-bold text-green-600">{formatCurrency(totalSavedDCAmount)}</p>
    </div>  
    </div>
</div>

{#if allItemsNotAvailableOrNotRequired}
  <div class="mt-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
    <div class="flex items-center">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="ml-3">
        <p class="text-sm text-red-700 font-medium">
{#if allItemsNotAvailable}
   All items are marked as Not Available. Please save before proceeding.
{:else}
   All items are marked as Not Available or Not Required. Please save before proceeding.
{/if}
</p>
 </div>
</div>
 <div class="mt-4">
   <button 
     type="button" 
     on:click={handleSaveAllNotAvailable} 
     class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 ease-in-out"
   >
     Save All
   </button>
  </div>
 </div>
{:else}
         <!-- Display current unsaved total -->
  <!-- <div class="mt-4">
    <h4 class="text-lg font-bold mb-2 inline-block mr-2">Current Unsaved Total:</h4>
    <p class="inline-block">{formatCurrency(dcOrderTotal.subtotal)}</p>
  </div> -->
  {#if anyItemNotAvailable && !userEnabledPartialDelivery}
  <div class="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
    <p class="font-bold">Some items are not available.</p>
    <p>Enable partial delivery to create DCs for available items, or wait until all items become available.</p>
  </div>
{/if}
{#if showDCBoxDetails}
        {#each dcBoxes as dc, index}
              <div class="bg-white bg-opacity-60 p-8 mt-4 rounded-xl shadow-lg mb-10 relative backdrop-blur-sm border border-gray-200 hover:shadow-xl transition-shadow duration-300">
                {#if !dc.isSaved && index !== 0}
                  <button
                    type="button"
                    class="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors duration-200"
                    on:click={() => removeDC(index)}
                  >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  </button>
                {/if}
                <div 
                class="bg-gray-100 p-6 rounded-lg shadow-md mb-8 transition-all duration-300 ease-in-out hover:shadow-xl focus-within:shadow-xl focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
                role="group"
                aria-labelledby="dc-details-title-{index}"
                on:mouseenter={() => isHovered = true}
                on:mouseleave={() => isHovered = false}
              >
                <h4 id="dc-details-title-{index}" class="text-xl font-bold mb-6 text-gray-800 flex items-center">
                  <span class="mr-2">{dc.billType === 'E-way' ? 'E-way Bill' : 'DC'} Details</span>
                  {#if isHovered}
                    <span class="text-sm font-normal text-gray-500" transition:fade>#{index + 1}</span>
                  {/if}
                </h4>
                
                <div class="space-y-6">
                  <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                    <div class="flex-1">
                      <label for="dc-number-{index}" class="block text-sm font-medium text-gray-700 mb-1">
                        {dc.billType === 'E-way' ? 'E-way Number:' : 'DC Number:'}
                      </label>
                      <div class="relative">
                      <input 
                        type="text" 
                        id="dc-number-{index}"
                        bind:value={dc.DCNumber}
                        bind:this={inputRef} 
                        placeholder={dc.billType === 'E-way' ? "Enter E-way number" : "Enter DC number"}
                        class="block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        class:opacity-50={dc.isSaved}
                        disabled={dc.isSaved || !isEditing}
                        on:focus={handleFocus}
                        on:blur={handleBlur}
                        on:keydown={handleKeyDown}
                        aria-describedby="dc-status-{index}"
          />
          {#if dc.isSaved}
            <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Check class="h-5 w-5 text-green-400" aria-hidden="true" />
                </div>
                    {/if}  
                    </div>
                  </div>
                  <div class="flex-1">
                    <label for="dc-status-{index}" class="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                    <div class="relative">
                    <input 
                      type="text"
                      id="dc-status-{index}" 
                      bind:value={dc.status}
                      class="block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md shadow-sm bg-gray-50"
                      disabled
                      aria-live="polite"
          />
          {#if dc.validatedData}
            <button
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500 transition-colors duration-200"
              on:click={() => showDCDetails(index)}
              aria-label="Show details"
            >
              <Info size="20" aria-hidden="true" />
            </button>
        {/if}
      </div>
    </div>
  </div>
        
  <div class="flex justify-end">
        <button
        class="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 ease-in-out transform hover:scale-105"
        on:click={() => validateDC(index)}
        disabled={dc.isSaved}
        aria-label={dc.isSaved ? "Already validated" : "Validate"}
        > 
         Validate
        </button>
      </div>
                </div>
              </div>

                                  <!-- Details Popup -->
{#if showDetailsModal && selectedDC}
<div class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div class="bg-white p-6 rounded-xl max-w-lg w-full shadow-2xl transform transition-all duration-300 ease-out scale-95 hover:scale-100">
    <h2 class="text-2xl font-bold mb-6 text-gray-800">DC Details</h2>
    <div class="space-y-4 mb-6">
      <p class="flex justify-between">
        <span class="font-semibold text-gray-600">DC Number:</span>
        <span class="text-gray-800">{selectedDC.validatedData.deliverychallan_number}</span>
      </p>
      <p class="flex justify-between">
        <span class="font-semibold text-gray-600">Customer Name:</span>
        <span class="text-gray-800">{selectedDC.validatedData.customer_name}</span>
      </p>
      <p class="flex justify-between">
        <span class="font-semibold text-gray-600">Date:</span>
        <span class="text-gray-800">{selectedDC.validatedData.date}</span>
      </p>
      <p class="flex justify-between">
        <span class="font-semibold text-gray-600">Total:</span>
        <span class="text-gray-800">₹{selectedDC.validatedData.total}</span>
      </p>
      <p class="flex justify-between items-center">
        <span class="font-semibold text-gray-600">Status:</span>
        <span class="px-2 py-1 rounded-full text-sm font-medium 
          {selectedDC.validatedData.status === 'Completed' ? 'bg-green-100 text-green-800' : 
           selectedDC.validatedData.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
           'bg-red-100 text-red-800'}">
          {selectedDC.validatedData.status}
        </span>
      </p>
      </div>
        <button
        class="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        on:click={closeDetailsModal}
        >
          Close
        </button>
  </div>
</div>
{/if}

                <div class="flex justify-center mb-8">
                  <div class="bill-type-buttons inline-flex bg-gray-100 p-1 rounded-xl shadow-inner">
                    <button
                      class="px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ease-in-out {dc.billType === 'DC' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:bg-gray-200'}"
                    >
                      DC Bill
                    </button>
                    <button
                     class="px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ease-in-out {dc.billType === 'E-way' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:bg-gray-200'}"
                    >
                      E-way Bill
                    </button>
                  </div>
                </div>

                <div class="bg-gray-100 shadow-md rounded-lg p-6 space-y-6">
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label for="tracking-no-{index}" class="block text-sm font-medium text-gray-700 mb-1">POD Number:</label>
                      <input type="text" id="tracking-no-{index}" bind:value={dc.PODNo} class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={dc.isSaved || !isEditing}>
                    </div>

                    <div>
                      <label for="dispatched-date-{index}" class="block text-sm font-medium text-gray-700 mb-1">Dispatch Date:</label>
                      <input type="date" id="dispatched-date-{index}" bind:value={dc.DispatchDate} class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" max={new Date().toISOString().split('T')[0]} required disabled={dc.isSaved || !isEditing}>
                    </div>

                    <div>
                      <label for="delivery-date-{index}" class="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery Date:</label>
                      <input type="date" id="delivery-date-{index}" bind:value={dc.EstdDeliveryDate} class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" min={dc.DispatchDate} required disabled={dc.isSaved || !isEditing}>
                    </div>

                    <div>
                      <label for="dc-amount-{index}" class="block text-sm font-medium text-gray-700 mb-1">
                        {dc.billType === 'E-way' ? 'E-way Bill Amount:' : 'DC Amount:'}
                      </label>
                      <p id="dc-amount-{index}" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                        {formatCurrency(dc.isSaved ? dc.dcAmount : dcOrderTotal.subtotal)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label for="attachment-{index}" class="block text-sm font-medium text-gray-700 mb-1">Attachment:</label>
        {#if !dc.isSaved}
          <input 
            type="file" 
            id="attachment-{index}" 
            on:change={(e) => handleFileChange(e, index)}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
            accept="application/pdf,image/*" 
          >
        {/if}
        {#if dc.attachment || dc.fileName}
          <div class="mt-2 flex items-center space-x-2">
            <span class="text-sm text-gray-600">{dc.fileName || 'File uploaded'}</span>
            <button 
              type="button" 
              on:click={() => openPreviewModalDC(index)}
              class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md transition-colors duration-200"
            >
              Preview
            </button>
                        <button 
                        type="button" 
                        on:click={() => downloadFile(dc.attachment, dc.fileName)}
              class="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-600 rounded-md transition-colors duration-200"
                      >
                        Download
                      </button>
                      </div>
                    {/if}
                  </div>
                  
              <!-- {#if dc.isSaved}
              <div class="mt-8">
                <h4 class="text-lg font-bold mb-4">Line Items in this {dcOrderTotal.subtotal >= 50000 ? 'E-way Bill' : 'DC'}</h4>
                <div class="overflow-x-auto bg-white shadow-md rounded-lg">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      {#each dc.lineItemIndices as itemIndex, i}
                        {@const item = lineItemsWithStatus[itemIndex]}
                        <tr class="hover:bg-gray-50 transition-colors duration-200">
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{i + 1}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity} {item.unit}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.rate)}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.amount)}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span class="px-2 py-1 rounded-full text-xs font-medium 
                            {item.status === 'need_to_purchase' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                            {item.status === 'need_to_purchase' ? 'Need to purchase locally' : 'Available'}
                          </span>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
              {/if} -->
  
              {#if dc.isSaved}
                <button 
                  type="button" 
                  on:click={() => generateAndDownloadPDF(dc)}
                  class="px-3 py-1 text-sm text-purple-600 hover:text-purple-800 border border-purple-600 rounded-md transition-colors duration-200"
                >
                  Download DC PDF
                </button>
              {/if}
                </div>
                {#if showCustomNameModal}
                <div class="fixed z-10 inset-0 overflow-y-auto">
                  <div class="flex items-center justify-center min-h-screen px-4">
                    <div class="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
                      <div class="bg-gray-50 px-4 py-3 sm:px-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">
                          Enter Custom File Name
                        </h3>
                      </div>
                      <div class="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <div class="mt-2">
                              <input 
                                type="text" 
                                bind:value={customFileName}
                                placeholder="Enter custom file name"
                                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-4 py-2"
                              >
                              <span class="text-sm text-gray-500 mt-1">.{customFileExtension}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button 
                          type="button" 
                          on:click={() => {
                            dcBoxes[currentDCIndex].fileName = `${customFileName}.${customFileExtension}`;
                            showCustomNameModal = false;
                            // Update the file preview
                            dcBoxes[currentDCIndex].attachment = dcBoxes[currentDCIndex].attachment; // Trigger update
                            dcBoxes = [...dcBoxes]; // Trigger reactivity
                          }}
                          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          on:click={() => showCustomNameModal = false}
                          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            
            
            <!-- Preview Modal -->
            <div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
              <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-3">
                  <p class="text-2xl font-bold">File Preview</p>
                  <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </div>
                
                <!-- Modal Body: Image and Iframe for file previews -->
                <div class="mt-4">
                  <!-- Image Preview -->
                  <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
                  
                  <!-- PDF Preview -->
                  <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>
            
                  <!-- Download link for non-previewable files (like .doc or .docx) -->
                  <a id="previewLink" class="block text-blue-500 underline text-center mt-4" style="display:none;" download>Download Document</a>
                </div>
                
              </div>
            </div>
              </div>
           {/each}

  
  <div class="flex justify-between mt-4">
  <div class="flex space-x-2">
    {#if !dcBoxes[dcBoxes.length - 1].isSaved}
    <button 
      type="button" 
      on:click={handleSave} 
      class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!canSaveDC(dcBoxes[dcBoxes.length - 1])}
    >
      Save
    </button>
    {/if}
    {#if (partialDelivery && userEnabledPartialDelivery && anyItemNotAvailable) || 
         (!dcBoxes[dcBoxes.length - 1].isSaved && canAddMoreDC)}
        <button 
          type="button" 
          on:click={addMoreDC} 
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          Add More +
        </button>
      {/if}
  </div>
  </div>
  {:else if anyItemNotAvailable}
  <!-- Show save button to move to next stage -->
  <div class="mt-6">
    <button 
      type="button" 
      on:click={saveAndGoToNextStage} 
      class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
    >
      Save and Go to Material to Procure
    </button>
</div>
{/if}
{/if}

{:else if moveStage === 2}
<!-- Material to Procure stage content -->
<div class="bg-white shadow-lg rounded-lg overflow-hidden">
  <div class="bg-gradient-to-r from-blue-500 to-indigo-500 p-4">
    <h4 class="text-2xl font-bold text-white text-center">Items to Procure</h4>
  </div>
  {#if notAvailableItems.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-100">
          <tr>
            {#each ['No.', 'Item', 'Quantity', 'Rate', 'Amount', 'Available- In stock', 'Need to purchase locally'] as header}
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each notAvailableItems as item, index (item.Itemid)}
            <tr class="hover:bg-gray-50 transition-colors duration-200">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity} {item.unit}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.rate)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.amount)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <label class="inline-flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={item.isAvailable} 
                  on:change={() => handleAvailabilityChange(item.Itemid, 'available')}
                  disabled={item.isAvailabilityFrozen || item.needToPurchaseLocally|| !isEditing}
                  class="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
                >
                <span class="ml-2">{item.isAvailable ? 'Yes' : 'No'}</span>
                </label>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <label class="inline-flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={item.needToPurchaseLocally} 
                  on:change={() => handleAvailabilityChange(item.Itemid, 'need_to_purchase')}
                  disabled={item.isAvailabilityFrozen || item.isAvailable|| !isEditing}
                  class="form-checkbox h-5 w-5 text-indigo-600 transition duration-150 ease-in-out"
                >
                <span class="ml-2">{item.needToPurchaseLocally ? 'Yes' : 'No'}</span>
              </label>
              </td>
            </tr>
            {#if item.isAvailable || item.needToPurchaseLocally}
              <tr transition:slide|local={{ duration: 300 }}>
                <td colspan="7" class="px-6 py-6 bg-gray-50">
                  <div class="bg-white p-4 rounded-lg shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div class="space-y-2">
                      <label for="serial-no-{item.Itemid}" class="block text-sm font-medium text-gray-700">Serial No.: *</label>
                      <input 
                        type="text" 
                        id="serial-no-{item.Itemid}" 
                        bind:value={notAvailableItems[index].serialNo} 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter serial number"
                        required
                      >
                    </div>
                    <div class="space-y-2">
                      <label for="invoice-no-{item.Itemid}" class="block text-sm font-medium text-gray-700">Invoice No.: *</label>
                      <input 
                        type="text" 
                        id="invoice-no-{item.Itemid}" 
                        bind:value={notAvailableItems[index].invoiceNo} 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter invoice number"
                        required
                      >
                    </div>
                    <div class="space-y-2">
                      <label for="attachment-{item.Itemid}" class="block text-sm font-medium text-gray-700">Attachment:</label>
                      <div class="flex items-center space-x-2">
                        <label for="attachment-{item.Itemid}" class="flex-grow cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
                          <span class="flex items-center justify-center">
                            <Paperclip class="w-5 h-5 mr-2" />
                            {item.invoiceattachment ? 'Change file' : 'Upload file'}
                          </span>
                      <input 
                        type="file" 
                        id="attachment-{item.Itemid}" 
                        on:change={(e) => handleAttachmentChange(e, item.Itemid)}
                        class="sr-only"
                        accept="application/pdf,image/*"
                      >
                    </label>
                      {#if notAvailableItems[index].invoiceattachment}
                          <button 
                            type="button" 
                            on:click={() => openPreviewModalMaterial(item)}
                            class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                          <Eye class="w-4 h-4 mr-2" />
                            Preview
                          </button>
                          {/if}
                        </div>
                    {#if notAvailableItems[index].invoiceattachment}
                          <p class="text-sm text-gray-500 truncate">{notAvailableItems[index].invoiceattachment.name}</p>
                      {/if}
                    </div>
                  </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
  <div class="p-8 text-center text-gray-500" transition:fade>
    <Trash2 class="mx-auto h-12 w-12 text-gray-400" />
    <h3 class="mt-2 text-sm font-medium text-gray-900">No items available</h3>
    <p class="mt-1 text-sm text-gray-500">No items marked as not available.</p>
  </div>
  {/if}
</div>

{#if showSaveButton}
  <div class="flex justify-end mt-4">
    <button 
      type="button" 
      on:click={handleSaveMaterialToProcure}
      class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 mr-2"
    >
      Save
    </button>
  </div>
{/if}

{#if allItemsSaved}
<div class="mt-4 text-center text-lg font-semibold text-green-600">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>
    All items have been saved. You can now submit the stage.
  </div>
{/if}

<!-- Preview Modal -->
<div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
  <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
    <div class="flex justify-between items-center pb-3">
      <p class="text-2xl font-bold">File Preview</p>
      <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
      </button>
    </div>
    <div class="mt-4">
      <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
      <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>
    </div>
  </div>
</div>
 
  {:else if moveStage === 3}
   <!-- On Going stage content -->
   <div class="relative pb-16">
   <div class="mb-6">
    {#each shipments as shipment, index}
        <div class="mb-6 p-6 bg-gray-100 shadow-md border border-gray-200 rounded-lg relative transition-transform transform hover:scale-[1.01]">
          {#if Stage5Data.rejected1}
          <div class="flex items-start bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 shadow-sm" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636L5.636 18.364M18.364 18.364L5.636 5.636" />
            </svg>
            <div>
              <strong class="font-semibold">Rejected:</strong>
              <span class="block sm:inline"> {Stage5Data.accRemark}</span>
            </div>
            </div>
          {:else if Stage5Data.rejected1===false}
            <div class="flex items-start bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 shadow-sm" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <div>
              <strong class="font-semibold">Approved:</strong>
              <span class="block sm:inline"> {Stage5Data.accRemark}</span>
            </div>
            </div>
          {/if}
          
          <!-- Dynamic header based on active tab -->
          <h5 class="text-xl font-bold text-gray-800 mb-4">
            {Stage3Data.activeTab === 'service' ? 'Service Report' : 'Installation Report'}
          </h5>          

          <!-- Toggle buttons for Installation and Service -->
          <div class="flex justify-center mb-6">
            <button
            class="px-6 py-3 rounded-l-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                  {Stage3Data.activeTab === 'installation' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
            on:click={() => {
              if (!shipment.isSaved || shipment.isEditing) {
                if (Stage3Data) {
                  Stage3Data.activeTab = 'installation';
                } else {
                  Stage3Data = { activeTab: 'installation' };
                }
                  shipments = [...shipments];
                }
              }}
              disabled={shipment.isSaved && !shipment.isEditing}
            >
              Installation
            </button>
            <button
              class="px-6 py-3 rounded-r-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                  {Stage3Data?.activeTab === 'service' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
              on:click={() => {
                if (!shipment.isSaved || shipment.isEditing) {
                  Stage3Data.activeTab = 'service';
                  shipments = [...shipments];
                }
              }}
              disabled={shipment.isSaved && !shipment.isEditing}
            >
              Service
            </button>
          </div>

        {#if Stage3Data.activeTab === 'installation'}
          <!-- Installation fields -->
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col">
                <label for="engineer-name-{index}" class="text-sm font-semibold text-gray-700">Engineer Name:</label>
                <input type="text" id="engineer-name-{index}" bind:value={Stage3Data.engName} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={shipment.isSaved && !shipment.isEditing || !isEditing}>
              </div>
              <div class="flex flex-col">
                <label for="schedule-date-{index}" class="text-sm font-semibold text-gray-700">Schedule date:</label>
                <input 
                  type="date" 
                  id="schedule-date-{index}" 
                  bind:value={Stage3Data.ScheduleDate} 
                  min={new Date().toISOString().split('T')[0]} 
                  class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                  required 
                  disabled={shipment.isSaved && !shipment.isEditing || !isEditing}
                >
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col">
                <label for="mobile-number-{index}" class="text-sm font-semibold text-gray-700">Mobile Number:</label>
                <input 
                  type="tel" 
                  id="mobile-number-{index}" 
                  bind:value={Stage3Data.MobNo} 
                  on:input={handleMobileInput}
                  class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                  pattern="[0-9]{10}"
                  maxlength="10"
                  required
                  disabled={shipment.isSaved && !shipment.isEditing || !isEditing}
                >
              </div>
              <div class="flex flex-col">
                <label for="vendor-name-{index}" class="text-sm font-semibold text-gray-700">Vendor Name:</label>
                <input type="text" id="vendor-name-{index}" bind:value={Stage3Data.VendorName} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={shipment.isSaved && !shipment.isEditing || !isEditing}>
              </div>
            </div>
            <div class="flex flex-col">
              <label for="installation-remarks-{index}" class="text-sm font-semibold text-gray-700">Installation Remarks:</label>
              <!-- <textarea id="installation-remarks-{index}" bind:value={Stage3Data.Remark} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" rows="4" disabled={shipment.isSaved && !shipment.isEditing || !isEditing}></textarea> -->
              {#if Array.isArray(Stage3Data.Remark)}
              {#each Stage3Data.Remark as remark, remarkIndex}
              <div class="mt-2 p-3 bg-gray-100 rounded-lg">
                <p class="text-sm text-gray-600">Remark #{remarkIndex + 1}</p>
                <p class="mt-1">{remark.content}</p>
                <p class="text-xs text-gray-500 mt-1">Submitted on: {remark.timestamp}</p>
              </div>
            {/each}
            {/if}
            {#if !shipment.isSaved && shipment.isEditing || isEditing}
            <textarea
              id="installation-remarks-{index}" 
              bind:value={shipment.currentRemark} 
              class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
              rows="4" 
              placeholder="Enter new installation remark here"
            ></textarea>
            <div class="relative flex space-y-4 mt-4">
            <button 
              type="button" 
              on:click={() => saveRemark(index)}
              class="px-5 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 focus:outline-none focus:ring focus:ring-green-300 transition duration-300 ease-in-out shadow-md"
              disabled={!shipment.currentRemark.trim()}
            >
              Save Remark
            </button>
          </div>
          {/if}
            </div>
            <div class="flex flex-col">
              <label for="installation-report-{index}" class="text-sm font-semibold text-gray-700">Installation Report Attachment:</label>
              {#if Stage5Data.rejected1 || (!shipment.isSaved || shipment.isEditing || !isEditing)}
              <input type="file" id="installation-report-{index}" on:change={(e) => handleStage3FileChange(e, 'installation', index)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
            {/if}
              {#if Stage3Data?.Report || ''}
              <div class="mt-2 flex items-center space-x-4">
                <span class="text-sm text-gray-600">{Stage3Data.ReportName || 'File uploaded'}</span>
                  <button 
                    type="button" 
                    on:click={() => previewFile()}
                    class="text-blue-600 hover:text-blue-800 underline"
                  >
                    Preview
                  </button>
                  <button 
                    type="button" 
                    on:click={() => downloadFile(Stage3Data.Report, Stage3Data.ReportName)}
                    class="text-green-600 hover:text-green-800 underline"
                  >
                    Download
                  </button>
                </div>
              {/if}
            </div>
            {#if showCustomNameModal}
                <div class="fixed z-10 inset-0 overflow-y-auto">
                  <div class="flex items-center justify-center min-h-screen px-4">
                    <div class="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
                      <div class="bg-gray-50 px-4 py-3 sm:px-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">
                          Enter Custom File Name
                        </h3>
                      </div>
                      <div class="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <div class="mt-2">
                              <input 
                                type="text" 
                                bind:value={customFileName}
                                placeholder="Enter custom file name"
                                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-4 py-2"
                              >
                              <span class="text-sm text-gray-500 mt-1">.{customFileExtension}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button 
                          type="button" 
                          on:click={() => {
                            Stage3Data.ReportName = `${customFileName}.${customFileExtension}`;
                            showCustomNameModal = false;
                            // Update the file preview
                            Stage3Data.Report = Stage3Data.Report; // Trigger update
        
                          }}
                          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          on:click={() => showCustomNameModal = false}
                          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
          </div>
        {:else}
          <!-- Service fields -->
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col">
                <label for="service-engineer-name-{index}" class="text-sm font-semibold text-gray-700">Engineer Name:</label>
                <input type="text" id="service-engineer-name-{index}" bind:value={Stage3Data.engName} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={shipment.isSaved && !shipment.isEditing || !isEditing}>
              </div>
              <div class="flex flex-col">
                <label for="service-schedule-date-{index}" class="text-sm font-semibold text-gray-700">Schedule date:</label>
                <input 
                  type="date" 
                  id="service-schedule-date-{index}" 
                  bind:value={Stage3Data.ScheduleDate} 
                  min={new Date().toISOString().split('T')[0]} 
                  class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                  required 
                  disabled={shipment.isSaved && !shipment.isEditing || !isEditing}
                >
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col">
                <label for="service-mobile-number-{index}" class="text-sm font-semibold text-gray-700">Mobile Number:</label>
                <input 
                    type="tel" 
                    id="service-mobile-number-{index}" 
                    bind:value={Stage3Data.MobNo} 
                    on:input={handleMobileInput}
                    class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                    pattern="[0-9]{10}"
                    maxlength="10"
                    required
                    disabled={shipment.isSaved && !shipment.isEditing || !isEditing}
                  >
              </div>
              <div class="flex flex-col">
                <label for="service-vendor-name-{index}" class="text-sm font-semibold text-gray-700">Vendor Name:</label>
                <input type="text" id="service-vendor-name-{index}" bind:value={Stage3Data.VendorName} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={shipment.isSaved && !shipment.isEditing || !isEditing}>
              </div>
            </div>
            <div class="flex flex-col">
              <label for="service-remarks-{index}" class="text-sm font-semibold text-gray-700">Service Remarks:</label>
              <!-- <textarea id="service-remarks-{index}" bind:value={Stage3Data.Remark} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" rows="4" disabled={shipment.isSaved && !shipment.isEditing || !isEditing}></textarea> -->
              {#if Array.isArray(Stage3Data.Remark)}
              {#each Stage3Data.Remark as remark, remarkIndex}
              <div class="mt-2 p-3 bg-gray-100 rounded-lg">
                <p class="text-sm text-gray-600">Remark #{remarkIndex + 1}</p>
                <p class="mt-1">{remark.content}</p>
                <p class="text-xs text-gray-500 mt-1">Submitted on: {remark.timestamp}</p>
              </div>
              {/each}
              {/if}
              {#if !shipment.isSaved && shipment.isEditing || isEditing}
            <textarea 
              id="service-remarks-{index}" 
              bind:value={shipment.currentRemark} 
              class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
              rows="4" 
              placeholder="Enter new service remark here"
            ></textarea>
            <div class="relative flex space-x-4 mt-4">
            <button 
              type="button" 
              on:click={() => saveRemark(index)}
              class="px-5 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 focus:outline-none focus:ring focus:ring-green-300 transition duration-300 ease-in-out shadow-md"
              disabled={!shipment.currentRemark.trim()}
            >
              Save Remark
            </button>
          </div>
          {/if}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex flex-col">
                <label for="service-report-{index}" class="text-sm font-semibold text-gray-700">Service Report Attachment:</label>
                {#if Stage5Data.rejected1 || (!shipment.isSaved || shipment.isEditing)}
                <input type="file" id="service-report-{index}" on:change={(e) => handleStage3FileChange(e, 'service', index)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                {/if}
                {#if Stage3Data?.Report || ''}
                  <div class="mt-2 flex items-center space-x-4">
                    <span class="text-sm text-gray-600">{Stage3Data.ReportName || 'File uploaded'}</span>
                    <button 
                      type="button" 
                      on:click={() => previewFile()}
                      class="text-blue-600 hover:text-blue-800 underline"
                    >
                      Preview
                    </button>
                    <button 
                      type="button" 
                      on:click={() => downloadFile(Stage3Data.Report, Stage3Data.ReportName)}
                      class="text-green-600 hover:text-green-800 underline"
                    >
                      Download
                    </button>
                  </div>
                {/if}
              </div>
              <div class="flex flex-col">
                <label for="service-ticket-id-{index}" class="text-sm font-semibold text-gray-700">Service Ticket Id:</label>
                <input type="text" id="service-ticket-id-{index}" bind:value={Stage3Data.Ticketid} class="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required disabled={shipment.isSaved && !shipment.isEditing || !isEditing}>
              </div>
            </div>
          </div>
     {/if}

          {#if showCustomNameModal}
                <div class="fixed z-10 inset-0 overflow-y-auto">
                  <div class="flex items-center justify-center min-h-screen px-4">
                    <div class="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
                      <div class="bg-gray-50 px-4 py-3 sm:px-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">
                          Enter Custom File Name
                        </h3>
                      </div>
                      <div class="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <div class="mt-2">
                              <input 
                                type="text" 
                                bind:value={customFileName}
                                placeholder="Enter custom file name"
                                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-4 py-2"
                              >
                              <span class="text-sm text-gray-500 mt-1">.{customFileExtension}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button 
                          type="button" 
                          on:click={() => {
                            Stage3Data.ReportName = `${customFileName}.${customFileExtension}`;
                            showCustomNameModal = false;
                            // Update the file preview
                            Stage3Data.Report = Stage3Data.Report; // Trigger update
        
                          }}
                          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          on:click={() => showCustomNameModal = false}
                          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              
        {/if}

        {#if !shipment.isSaved || shipment.isEditing}
        <div class="relative flex space-x-4 mt-4">
          {#if moveStage>=currentStage}
          <button 
            type="button" 
            on:click={() => saveShipment(index)}
            class="px-5 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 focus:outline-none focus:ring focus:ring-green-300 transition duration-300 ease-in-out shadow-md"
            disabled={isSave3Disabled}
          >
          {shipment.isEditing ? 'Update' : 'Save'}
        </button>
        {/if}
        {#if Stage5Data.rejected1}
  <div class="relative flex space-x-4 mt-4">
    <button 
      type="button" 
      on:click={() => resubmitReport(index)}
      class="px-5 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300 transition duration-300 ease-in-out shadow-md"
      disabled={!Stage3Data.Report} 
    >
      Resubmit Report
    </button>
  </div>
        {/if}
        {#if shipment.isEditing}
          <button 
            type="button" 
            on:click={() => cancelEdit(index)}
            class="px-5 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300 transition duration-300 ease-in-out shadow-md"
          >
            Cancel
          </button>
        {/if}
      </div>
      {:else}
      <div class="relative flex mt-4">
        <button 
          type="button" 
          on:click={() => editShipment(index)}
          class="px-5 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300 transition duration-300 ease-in-out shadow-md"
        >
          Edit
          </button>
        </div>
        {/if}
      </div>
    {/each}

  </div>
  
  <!-- Preview Modal -->
<div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
  <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
    
    <!-- Modal Header -->
    <div class="flex justify-between items-center pb-3">
      <p class="text-2xl font-bold">File Preview</p>
      <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
    
    <!-- Modal Body: Image and Iframe for file previews -->
    <div class="mt-4">
      <!-- Image Preview -->
      <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
      
      <!-- PDF Preview -->
      <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>

      <!-- Download link for non-previewable files (like .doc or .docx) -->
      <a id="previewLink" class="block text-blue-500 underline text-center mt-4" style="display:none;" download>Download Document</a>
    </div>
    
  </div>
</div>

        
        <!-- Return Pickup toggle button -->
        {#if moveStage===currentStage}
        <button 
          type="button" 
          on:click={() => {
            Stage4Data.returnPickupRequested = !Stage4Data.returnPickupRequested;
            const returnPickupStageIndex = stageData.findIndex(stage => stage.title === "Stage 4. Return Pickup");
            if (returnPickupStageIndex !== -1) {
            stageData[returnPickupStageIndex].visible = Stage4Data.returnPickupRequested;
            stageData = [...stageData]; // Trigger reactivity
            }
          }}
          class="mt-4 mb-4 px-6 py-3 {Stage4Data.returnPickupRequested ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-semibold rounded-lg transition duration-300 ease-in-out shadow-lg"
          disabled={returnPickupDetailsSaved} 
        >
          {Stage4Data.returnPickupRequested ? 'Cancel Return Pickup' : 'Request Return Pickup'}
        </button>{/if}
       <!-- Return Pickup Details box -->
       {#if Stage4Data.returnPickupRequested && !showReturnPickupConfirmation}
       <div class="mb-8 p-6 border border-gray-300 rounded-lg bg-gray-50 shadow-md">
        <h4 class="text-lg font-bold text-gray-800 mb-4">Return Pickup Details</h4>
        <div class="space-y-6">
          <div class="flex space-x-6">
             <div class="flex-1">
               <label for="return-pickup-name" class="block text-sm font-medium text-gray-700">Name:</label>
               <input 
                 type="text" 
                 id="return-pickup-name" 
                 bind:value={Stage4Data.ReturnPickupName} 
                 class="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-12 px-4 text-lg" 
                required
                disabled={returnPickupDetailsSaved || !isEditing}
               >
             </div>
             <div class="flex-1">
               <label for="return-pickup-mobile" class="block text-sm font-medium text-gray-700">Mobile Number:</label>
               <input 
                 type="tel" 
                 id="return-pickup-mobile" 
                 bind:value={Stage4Data.ReturnPickupMobile} 
                 on:input={handleReturnPickupMobileInput}
                 class="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-12 px-4 text-lg" 
                 pattern="[0-9]{10}"
                 maxlength="10"
                 required
                 disabled={returnPickupDetailsSaved || !isEditing}
               >
             </div>
           </div>
           <div>
             <label for="return-pickup-remark" class="block text-sm font-medium text-gray-700">Project Manager's Remark:</label>
             <textarea 
               id="return-pickup-remark" 
               bind:value={Stage4Data.ReturnPickupRemark} 
               class="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 px-4 text-lg" 
                rows="3" 
                required
                disabled={returnPickupDetailsSaved || !isEditing}
             ></textarea>
           </div>

         <!-- Line Items -->
<div class="mt-4">
  <h5 class="text-md font-semibold text-gray-700 mb-2">Line Items for Return Pickup</h5>
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-100">
      <tr>
        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Return Pickup</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      {#each lineItemsWithStatus as item (item.Itemid)}
      <tr class="hover:bg-gray-50 transition duration-200 ease-in-out">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
        <td class="px-6 py-4 text-sm text-gray-500 relative group">
            {item.returnQuantity ?? item.quantity} {item.unit}
            {#if !returnPickupDetailsSaved}
            <button
            type="button"
            class="hidden group-hover:inline-flex items-center ml-2 cursor-pointer text-xs bg-transparent border-none p-0"
            on:click={() => editQuantity(item)}
            aria-label="Edit quantity"
          >
          <Edit size="18" />
          </button>
            {/if}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">{formatCurrency(item.rate)}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
            {formatCurrency((item.returnQuantity ?? item.quantity) * item.rate)}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">
            <input 
              type="checkbox" 
              bind:checked={item.returnPickup}
              disabled={returnPickupDetailsSaved || !isEditing}
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

           {#if !returnPickupDetailsSaved}
             <button 
               type="button" 
               on:click={saveReturnPickupDetails}
               class="mt-4 px-5 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 focus:ring-2 focus:ring-green-300 transition duration-300 ease-in-out shadow-lg absolute bottom-2 right-2"
             >
               Save
             </button>
           {/if}
         </div>
       </div>
     {/if}

 {#if showReturnPickupConfirmation}
 <div class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
  <div class="relative mx-auto p-6 w-full max-w-md bg-white rounded-lg shadow-lg transform transition-all">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-semibold text-gray-900">Return Pickup</h3>
       <button 
         on:click={() => showReturnPickupConfirmation = false}
         aria-label="Close" 
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p class="text-gray-700 mb-6">Are you sure you want to request a return pickup?</p>
      <div class="flex justify-end space-x-3">
        <button 
          on:click={() => showReturnPickupConfirmation = false}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-all"
       >
         Cancel
       </button>
       <button 
         on:click={confirmReturnPickup}
         class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
       >
         Confirm
       </button>
     </div>
   </div>
 </div>
{/if}
   </div>

   
   {:else if moveStage === 4 && stageData[4].visible}
   <!-- Return Pickup Stage -->
   <div class="mb-8 p-6 border border-gray-200 shadow-md rounded-lg bg-gray-100 relative">
    {#if Stage5Data.rejected2}
    <div class="flex items-start bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 shadow-sm" role="alert">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636L5.636 18.364M18.364 18.364L5.636 5.636" />
      </svg>
      <div>
        <strong class="font-semibold">Rejected:</strong>
        <span class="block sm:inline">{Stage5Data.retaccRemark}</span>
      </div>
    </div>
    {:else if Stage5Data.rejected2===false}
    <div class="flex items-start bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 shadow-sm" role="alert">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <div>
        <strong class="font-semibold">Approved:</strong>
        <span class="block sm:inline">{Stage5Data.retaccRemark}</span>
      </div>
      </div>
  {/if}
  <h4 class="text-lg font-bold mb-4">Return Pickup Report</h4>
  <div class="space-y-8">
    <!-- Name and Mobile Section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
      <div>
        <label for="return-pickup-name" class="block text-sm font-semibold text-gray-800">Name:</label>
            <input 
              type="text" 
              id="return-pickup-name" 
              bind:value={Stage4Data.ReturnPickupName} 
              class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
            required
            disabled
        >
      </div>
      <div>
        <label for="return-pickup-mobile" class="block text-sm font-semibold text-gray-800">Mobile Number:</label>
        <input 
          type="tel" 
          id="return-pickup-mobile" 
          bind:value={Stage4Data.ReturnPickupMobile} 
          on:input={handleReturnPickupMobileInput}
          class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
          maxlength="10"
          required
          disabled
        >
      </div>
    </div>

    <div>
      <label for="return-pickup-remark" class="block text-sm font-medium text-gray-700">Project Manager's Remark:</label>
          <textarea 
            id="return-pickup-remark" 
            bind:value={Stage4Data.ReturnPickupRemark} 
            class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
            rows="5"
            required
            disabled
      ></textarea>
    </div>

    <!-- Items for Return Pickup -->
    <div class="mt-6">
      <h5 class="text-md font-semibold text-gray-800 mb-4">Items for Return Pickup</h5>
      <table class="min-w-full divide-y divide-gray-200 bg-white shadow-md rounded-lg">
        <thead class="bg-gray-100 text-gray-600 uppercase text-sm">
     <tr>
      <th class="px-6 py-4 text-left font-semibold">Item</th>
      <th class="px-6 py-4 text-left font-semibold">Quantity</th>
      <th class="px-6 py-4 text-left font-semibold">Rate</th>
      <th class="px-6 py-4 text-left font-semibold">Amount</th> 
     </tr>
   </thead>
   <tbody class="bg-white divide-y divide-gray-200 text-gray-700">
     {#each lineItemsWithStatus.filter(item => item.returnPickup) as item (item.Itemid)}
       <tr>
        <td class="px-6 py-4 text-base font-medium">{item.name}</td>
        <td class="px-6 py-4 text-base">{item.returnQuantity ?? item.quantity} {item.unit}</td>
        <td class="px-6 py-4 text-base">{formatCurrency(item.rate)}</td>
        <td class="px-6 py-4 text-base">{formatCurrency((item.returnQuantity ?? item.quantity) * item.rate)}</td>
       </tr>
     {/each}
   </tbody>
 </table>
    </div>
  </div>

    <div 
  class="bg-slate-200 p-6 mt-4 rounded-lg shadow-md mb-8 transition-all duration-300 ease-in-out hover:shadow-xl focus-within:shadow-xl focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
  role="group"
  aria-labelledby="dc-details-title-{1}"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
>
  <h4 id="dc-details-title-{1}" class="text-xl font-bold mb-6 text-gray-800 flex items-center">
    <span class="mr-2">{"DC"} Details</span>
  </h4>
  
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
    <div class="flex-1">
      <label for="dc-number-{1}" class="block text-sm font-medium text-gray-700 mb-1">
        DC Number:
      </label>
      <div class="relative">
      <input 
        type="text" 
        id="dc-number-{1}"  
        bind:value={Stage4Data.DCNumber} 
            bind:this={inputRef}
            placeholder={"Enter DC number"}
            class="block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            disabled={returnPickup.isSaved || !isEditing}
            on:focus={handleFocus}
            on:blur={handleBlur}
            on:keydown={handleKeyDown}
            aria-describedby="dc-status-{1}"
          />
          {#if returnPickup.isSaved}
            <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Check class="h-5 w-5 text-green-400" aria-hidden="true" />
    </div>
    {/if}
  </div>
</div>
    <div class="flex-1">
      <label for="dc-status-{1}" class="block text-sm font-medium text-gray-700 mb-1">Status:</label>
        <div class="relative">
          <input
            type="text"
            id="dc-status-{1}"
            bind:value={Stage4Data.status}
            class="block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md shadow-sm bg-gray-50"
            disabled
            aria-live="polite"
          />
          {#if Stage4Data.validatedData}
            <button
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500 transition-colors duration-200"
              on:click={() => showDCshubhamDetails()}
              aria-label="Show details"
            >
              <Info size="20" aria-hidden="true" />
            </button>
          {/if}
        </div>
      </div>
    </div>
    
    <div class="flex justify-end">
      <button
        class="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 ease-in-out transform hover:scale-105"
        on:click={() => validationSHUBHAMDC()}
        disabled={returnPickup.isSaved}
        aria-label={returnPickup.isSaved ? "Already validated" : "Validate"}
      >
        Validate
      </button>
    </div>
  </div>
</div>

{#if showDetailsModal}
  <div class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white p-6 rounded-xl max-w-lg w-full shadow-2xl transform transition-all duration-300 ease-out scale-95 hover:scale-100">
      <h2 class="text-2xl font-bold mb-6 text-gray-800">DC Details</h2>
      <div class="space-y-4 mb-6">
        <p class="flex justify-between">
          <span class="font-semibold text-gray-600">DC Number:</span>
          <span class="text-gray-800">{Stage4Data.validatedData.deliverychallan_number}</span>
        </p>
        <p class="flex justify-between">
          <span class="font-semibold text-gray-600">Customer Name:</span>
          <span class="text-gray-800">{Stage4Data.validatedData.customer_name}</span>
        </p>
        <p class="flex justify-between">
          <span class="font-semibold text-gray-600">Date:</span>
          <span class="text-gray-800">{Stage4Data.validatedData.date}</span>
        </p>
        <p class="flex justify-between">
          <span class="font-semibold text-gray-600">Total:</span>
          <span class="text-gray-800">₹{Stage4Data.validatedData.total}</span>
        </p>
        <p class="flex justify-between items-center">
          <span class="font-semibold text-gray-600">Status:</span>
          <span class="px-2 py-1 rounded-full text-sm font-medium 
            {Stage4Data.validatedData.status === 'Completed' ? 'bg-green-100 text-green-800' : 
             Stage4Data.validatedData.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
             'bg-red-100 text-red-800'}">
            {Stage4Data.validatedData.status}
          </span>
        </p>
      </div>
      <button
        class="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        on:click={closeDetailsModal}
      >
        Close
      </button>
    </div>
  </div>
{/if}

        <!-- Additional fields -->
<div class="space-y-8 pt-6">
  <!-- DC Number, Courier Tracking No., and DC Amount Section -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-8">
    <div>
      <label for="tracking-no" class="block text-sm font-semibold text-gray-800">Courier's Tracking No.</label>
      <input 
        type="text" 
        id="tracking-no" 
        bind:value={Stage4Data.CourierTrackNo} 
        class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
        required
        disabled={returnPickup.isSaved || !isEditing}
      >
    </div>
    <div>
      <label for="dc-amount" class="block text-sm font-semibold text-gray-800">DC Amount:</label>
      <input 
        type="number"
        id="dc-amount"
        bind:value={Stage4Data.DCAmount} 
        on:input={formatAmountreturn}
        class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
        required
        disabled={returnPickup.isSaved || !isEditing}
      >
    </div>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
    <div>
      <label for="dispatched-date" class="block text-sm font-semibold text-gray-800">Dispatched Date:</label>
      <input 
        type="date" 
        id="dispatched-date" 
            bind:value={Stage4Data.DispatchDate} 
            on:change={updateDeliveryDateMin}
        max={getCurrentDate()}
        class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
        required
        disabled={returnPickup.isSaved || !isEditing}
      >
    </div>
    <div>
      <label for="delivery-date" class="block text-sm font-semibold text-gray-800">Delivery Date:</label>
      <input 
        type="date" 
        id="delivery-date" 
        bind:value={Stage4Data.DeliveryDate} 
        min={Stage4Data.DispatchDate}
        class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
        required
        disabled={returnPickup.isSaved || !isEditing}
      >
    </div>
  </div>
  <div>
    <label for="return-pickup-remark" class="block text-sm font-semibold text-gray-800">Remark:</label>
    <textarea 
    id="return-pickup-remark" 
    bind:value={Stage4Data.Remark} 
    class="mt-3 w-full px-4 py-3 border-gray-300 text-base rounded-lg shadow-md focus:ring-blue-500 focus:border-blue-500" 
    rows="4"
    required
    disabled={returnPickup.isSaved || !isEditing}
    ></textarea>
  </div>
</div>
  <div class="mt-6">
    <label for="attachment" class="block text-sm font-semibold text-gray-800">Attachment:</label>
    {#if !returnPickup.isSaved}
    <input 
    type="file" 
    id="attachment" 
    on:change={handleReturnPickupFileChange}
    class="mt-3 block w-full px-4 py-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base" 
      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      required
    >
    {/if}
        {#if Stage4Data.Attachment}
        <div class="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700">{Stage4Data.fileName || 'File uploaded'}</span>
            <div class="space-x-4">
              <!-- Preview button -->
        <button 
          type="button" 
          on:click={previewReturnPickupFile}
          class="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
        >
          Preview
        </button>
        <button 
          type="button" 
          on:click={() => downloadFile(Stage4Data.Attachment, Stage4Data.fileName)}
          class="text-sm text-green-600 hover:text-green-800 font-medium underline"
        >
          Download
        </button>
      </div>
    </div>
      </div>
      {#if showCustomNameModal}
                <div class="fixed z-10 inset-0 overflow-y-auto">
                  <div class="flex items-center justify-center min-h-screen px-4">
                    <div class="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
                      <div class="bg-gray-50 px-4 py-3 sm:px-6">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">
                          Enter Custom File Name
                        </h3>
                      </div>
                      <div class="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <div class="mt-2">
                              <input 
                                type="text" 
                                bind:value={customFileName}
                                placeholder="Enter custom file name"
                                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-4 py-2"
                              >
                              <span class="text-sm text-gray-500 mt-1">.{customFileExtension}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button 
                          type="button" 
                          on:click={() => {
                            Stage4Data.fileName = `${customFileName}.${customFileExtension}`;
                            showCustomNameModal = false;
                            // Update the file preview
                            Stage4Data.Attachment = Stage4Data.Attachment; // Trigger update
        
                          }}
                          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          on:click={() => showCustomNameModal = false}
                          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
    {/if}
  </div>

  {#if !returnPickup.isSaved}
  <div class="flex justify-end mt-6">
    <button 
      type="button" 
      on:click={saveReturnPickup}
      class="px-6 py-2 bg-green-500 text-white font-semibold text-base rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 transition-all duration-150 ease-in-out"
    >
      Save
    </button>
  </div>
  {/if}
</div>


<!-- Preview Modal -->
<div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
  <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
    
    <!-- Modal Header -->
    <div class="flex justify-between items-center pb-3">
      <p class="text-2xl font-bold">File Preview</p>
      <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
    
    <!-- Modal Body: Image and Iframe for file previews -->
    <div class="mt-4">
      <!-- Image Preview -->
      <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
      
      <!-- PDF Preview -->
      <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>

      <!-- Download link for non-previewable files (like .doc or .docx) -->
      <a id="previewLink" class="block text-blue-500 underline text-center mt-4" style="display:none;" download>Download Document</a>
    </div>
    
  </div>
</div>


{:else if moveStage  === stageData.findIndex(stage => stage.title === "Stage 5. Share with Account")}

  <!-- Share with Account stage content -->
  <h4 class="text-lg font-bold mb-2">Installation or Service Report</h4>
  <!-- Ongoing Shipments -->
  <!-- {#each shipments.filter(s => s.isSaved) as shipment, index} -->
  {#if Stage3Data}
  <div class="bg-white shadow-md rounded-lg p-6 mb-8">
    <h5 class="text-xl font-bold mb-4 text-gray-800">
      {Stage3Data.activeTab === 'installation' ? 'Installation Report' : 'Service Report'}
    </h5>
    <!-- Installation/Service Report Details -->
  <div class="space-y-4">
    <div>
      <label for="report-remarks-{index}" class="block text-sm font-medium text-gray-700 mb-1">
        {Stage3Data.activeTab === 'installation' ? 'Installation' : 'Service'} Remarks:
      </label>
      <!-- <textarea 
        id="report-remarks-{index}" 
        value={Stage3Data.Remark} 
        class="w-full px-3 py-2 text-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
        rows="4"  
        disabled
      ></textarea> -->
      {#each Stage3Data.Remark as remark, remarkIndex}
      <div class="mt-2 p-3 bg-gray-100 rounded-lg">
        <p class="text-sm text-gray-600">Remark #{remarkIndex + 1}</p>
        <p class="mt-1">{remark.content}</p>
        <p class="text-xs text-gray-500 mt-1">Submitted on: {remark.timestamp}</p>
      </div>
{/each}
    </div>
    <div>
      <label for="report-attachment-{index}" class="block text-sm font-medium text-gray-700 mb-1">
        {Stage3Data.activeTab === 'installation' ? 'Installation' : 'Service'} Report Attachment:
      </label>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-600">
            {Stage3Data.ReportName || 'File uploaded'}
          </span>
    <button 
      type="button" 
      on:click={() => previewFile()}
      class="text-blue-600 hover:text-blue-800 text-sm font-medium"
    >
      Preview
    </button>
    <button 
      type="button" 
      on:click={() => downloadFile(Stage3Data.Report,Stage3Data.ReportName)}
        class="text-green-600 hover:text-green-800 text-sm font-medium"
    >
      Download
    </button>
  </div>
</div>
</div>

      <!-- Approval/Rejection toggle buttons -->
      <div class="flex justify-center space-x-4 mt-6">
        <button
          type="button"
          class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.accStatus === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}"
          on:click={() => {
            if (!Stage5Data.isDataSaved1) {
              Stage5Data.accStatus = 'approved';
              Stage5Data.rejected1 = false;
            }
          }}
          disabled={Stage5Data.isDataSaved1}
        >
          Approved
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.accStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-red-100'}"
          on:click={() => {
            if (!Stage5Data.isDataSaved1) {
              Stage5Data.accStatus = 'rejected';
              Stage5Data.rejected1 = true;
            }
          }}
          disabled={Stage5Data.isDataSaved1}
        >
          Rejected
        </button>
      </div>

      <!-- Remark input field -->
      {#if Stage5Data.accStatus}
        <div class="mt-6">
          <label for="account-remark-{index}" class="block text-sm font-medium text-gray-700 mb-1">
            {Stage5Data.accStatus === 'approved' ? 'Approval' : 'Rejection'} Remark:
          </label>
          <textarea
            id="account-remark-{index}"
            bind:value={Stage5Data.accRemark}
            class="w-full px-3 py-2 text-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
            disabled={Stage5Data.isDataSaved1 || !isEditing}
        ></textarea>
      </div>
      {/if}

      <!-- Save/Edit button -->
      <div class="mt-6 text-right">
      <button 
        type="button" 
        on:click={() => {
          if (Stage5Data.isDataSaved1) {
            Stage5Data.isDataSaved1 = false;
            Stage5Data.isEditing1 = true;
          } else {
            if (!Stage5Data.accStatus || !Stage5Data.accRemark || Stage5Data.accRemark.trim() === '') {
              alert("Please fill up the details before saving");
              return;
            }
            Stage5Data.isDataSaved1 = true;
            Stage5Data.isEditing1 = false;
          }
          shipments = [...shipments];
        }}
        class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.isDataSaved1 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white"
      >
        {Stage5Data.isDataSaved1 ? 'Edit' : 'Save'}
      </button>
    </div>
  </div>
  <div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
    <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      
      <!-- Modal Header -->
      <div class="flex justify-between items-center pb-3">
        <p class="text-2xl font-bold">File Preview</p>
        <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
      
      <!-- Modal Body: Image and Iframe for file previews -->
      <div class="mt-4">
        <!-- Image Preview -->
        <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
        
        <!-- PDF Preview -->
        <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>
  
        <!-- Download link for non-previewable files (like .doc or .docx) -->
        <a id="previewLink" class="block text-blue-500 underline text-center mt-4" style="display:none;" download>Download Document</a>
      </div>
      
    </div>
  </div>
  {/if}
  <!-- {/each} -->

  {#if Stage4Data===true}
  <h4 class="text-lg font-bold mb-2">Return Pickups Report</h4>
  <!-- Return Pickups -->
  <div class="bg-white shadow-lg rounded-lg p-6 mb-8 relative">
    <!-- Return pickup report remarks -->
    <div class="mb-6">
      <label for="return-pickup-remark" class="block text-sm font-semibold text-gray-700 mb-2">Return pickup report remarks:</label>
        <textarea 
        id="return-pickup-remark" 
        bind:value={Stage4Data.Remark}
        class="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
        rows="4" 
        required
        disabled
        ></textarea>
      </div>
      <div class="mb-6">
        <label for="attachment" class="block text-sm font-semibold text-gray-700 mb-2">Return pickup report attachment:</label>
      
      {#if Stage4Data.Attachment}
          <div class="mt-2 flex items-center space-x-4">
            <span class="text-sm text-gray-600">{Stage4Data.fileName || 'File uploaded'}</span>
            <button 
              type="button" 
              on:click={previewReturnPickupFile}
              class="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Preview
            </button>
            <button 
              type="button" 
              on:click={() => downloadFile(Stage4Data.Attachment, Stage4Data.fileName || '')}
              class="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Download
            </button>
          </div>
        {/if}
      </div>
      
      <!-- Approval/Rejection toggle buttons -->
      <div class="flex justify-center space-x-4 mb-6">
        <button
          type="button"
          class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.retaccStatus === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}"
          on:click={() => {
            if (!Stage5Data.isDataSaved2) {
              Stage5Data.retaccStatus = 'approved';
              Stage5Data.rejected2 = false;
            }
          }}
          disabled={Stage5Data.isDataSaved2}
        >
          Approved
        </button>
        
        <button
          type="button"
          class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.retaccStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-red-100'}"
          on:click={() => {
            Stage5Data.retaccStatus = 'rejected';
            Stage5Data.rejected2 = true;
        }}
        disabled={Stage5Data.isDataSaved2 || !isEditing}
      >
          Rejected
        </button>
      </div>

      {#if Stage5Data.retaccStatus}
        <div class="mt-6">
          <label for="account-remark-{index}" class="block text-sm font-medium text-gray-700 mb-1">
            {Stage5Data.retaccStatus === 'approved' ? 'Approval' : 'Rejection'} Remark:
          </label>
          <textarea
            id="account-remark-{index}"
            bind:value={Stage5Data.retaccRemark}
            class="w-full px-3 py-2 text-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
            disabled={Stage5Data.isDataSaved2 || !isEditing}
        ></textarea>
      </div>
      {/if}

      <div class="mt-6 text-right">
        <button 
          type="button" 
          on:click={() => {
            if (Stage5Data.isDataSaved2) {
              Stage5Data.isDataSaved2 = false;
              Stage5Data.isEditing2 = true;
            } else {
              if (!Stage5Data.retaccStatus || !Stage5Data.retaccRemark || Stage5Data.retaccRemark.trim() === '') {
                alert("Please fill up the details before saving");
                return;
              }
              Stage5Data.isDataSaved2 = true;
              Stage5Data.isEditing2 = false;
            }
          }}
          class="px-4 py-2 rounded-md font-medium transition-colors duration-200 {Stage5Data.isDataSaved2 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white"
        >
          {Stage5Data.isDataSaved2 ? 'Edit' : 'Save'}
        </button>
      </div>


      
    </div>

    <div id="previewModal" class="modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style="display:none;">
    <div class="modal-content relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      <div class="flex justify-between items-center pb-3">
        <p class="text-2xl font-bold">File Preview</p>
        <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={closePreviewModal}>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
        </button>
      </div>
      <div class="mt-4">
        <img id="previewImage" alt="File preview" class="max-w-full max-h-[70vh] mx-auto" style="display:none;">
        <iframe id="previewIframe" class="w-full h-[70vh]" style="display:none;" title="File preview content"></iframe>
      </div>
    </div>
    </div>
  {/if}
{/if}
 

        {#if showConfirmationPopup}
        <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div class="bg-white rounded-lg shadow-xl p-6 m-4 max-w-sm w-full">
            <h3 class="text-xl font-semibold mb-4 text-gray-800">Confirm Submission</h3>
            <p class="mb-6 text-gray-600">Are you sure you want to submit {stageData[currentStage].title}?</p>
            <div class="flex justify-end space-x-3">
              <button 
                on:click={() => showConfirmationPopup = false}
                class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out"
              >
                Cancel
              </button>
              <button 
                on:click={confirmSubmit}
                class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-150 ease-in-out"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      {/if}

      <div class="mt-8 space-y-6">
        <!-- Navigation and action buttons -->
        <div class="flex flex-wrap items-end gap-4">
          <!-- <div class="space-x-2">
          <button 
            type="button" 
            on:click={goToPreviousStage}
            class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition duration-150 ease-in-out"
          >
            Previous Stage
          </button>
              <button 
              type="button" 
              on:click={goToNextStage} 
              class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition duration-150 ease-in-out"
              >
              Next Stage
          </button>
        </div> -->
          <!-- {#if stageData[currentStage].completed}
          <button 
          type="button" 
          on:click={editStage} 
          class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition duration-150 ease-in-out"
        >
                Edit
              </button>
            {/if}    -->    
            {#if moveStage >= currentStage}
            <button 
              type="submit" 
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition duration-150 ease-in-out ml-auto"
            >
              Submit
            </button>
           {/if}
                     
          </div>

    <!-- Time information -->
    <div class="flex flex-wrap justify-between text-sm text-gray-500">
      {#if stageStartTimes[currentStage]}
        <p>Started on: {stageStartTimes[currentStage]}</p>
      {/if}
      {#if lastSavedTimes[currentStage] && !lastSubmittedTimes[currentStage]}
        <p>Last saved on: {lastSavedTimes[currentStage]}</p>
      {:else if lastSubmittedTimes[currentStage]}
        <p>Last submitted on: {lastSubmittedTimes[currentStage]}</p>
      {/if}
    </div>
    </div>

  </form>
  </div>
</div>

<style>
  .modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0,0,0,0.4);
  }

  .modal-content {
    background-color: #fefefe;
    margin: 15% auto;
    padding: 20px;
    border: 1px solid #888;
    width: 80%;
    max-width: 800px;
  }
</style>
