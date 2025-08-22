import elements from './utils/elements.js';
import axios from 'axios';

const injectors = []; // Holds all the injectors in the order.

async function main() {
    elements.buttons.submit.addEventListener('click', handleSubmit);
    elements.buttons.add.addEventListener('click', handleAdd);
    elements.buttons.export.addEventListener('click', handleExport);
    addInputValidations();
    updateExportCombo();
    resetAll();
}

/**
 * Handles the user pressing the submit button. Sends the information to the
 * server for a database query.
 */
async function handleSubmit() {
    try {
        if (injectors.length === 0) {
            return window.alert('Enter at least one injector.');
        }
        if (elements.inputs.order.customer.value === '' || elements.inputs.order.part.value === '' || elements.inputs.order.ohm.value === '' || elements.inputs.order.make.value === '') {
            return window.alert('Fill out all the service fields');
        }
        const response = await axios.post('/api/service', {
            injectors,
            make: elements.inputs.order.make.value,
            part: elements.inputs.order.part.value,
            customer: elements.inputs.order.customer.value,
            ohm: elements.inputs.order.ohm.value
        });
        window.alert(`New Process ID: ${response.data.processId}`);
        resetAll();
    } catch (err) {
        console.log(err);
        window.alert(err.message);
    }
}

/**
 * Adds a new injector to the list of injectors.
 */
async function handleAdd() {
    const newInjector = {
        injectorSerial: elements.inputs.injector.injectorSerial.value,
        duty100Before: elements.inputs.injector.duty100Before.value,
        duty100After: elements.inputs.injector.duty100After.value,
        duty50Before: elements.inputs.injector.duty50Before.value,
        duty50After: elements.inputs.injector.duty50After.value,
        idleBefore: elements.inputs.injector.idleBefore.value,
        idleAfter: elements.inputs.injector.idleAfter.value,
    };
    injectors.push(newInjector);
    resetInjectorInputs();
    updateInjectorTable();
}

/**
 * Handles the export button. Takes the value of the process that the user
 * chooses in the selection field and opens a PDF using that process ID.
 */
async function handleExport() {
    try {
        const processId = elements.inputs.order.process.value;
        window.open(`/api/export?processId=${processId}`);
    } catch (err) {
        console.log(err.stack);
        window.alert(err.message);
    }
}

/**
 * Resets all the injector inputs.
 */
function resetInjectorInputs() {
    Object.values(elements.inputs.injector).forEach(input => input.value = '');
}

function updateInjectorTable() {
    elements.visuals.injectorTableBody.innerHTML = '';

    // Sorts the injectors by serial number.
    injectors.sort((a, b) => a.injectorSerial - b.injectorSerial);

    // Creates the injector table.
    for (let i = 0; i < injectors.length; i++) {
        const newRow = document.createElement('tr');
        newRow.addEventListener('click', () => {
            injectors.splice(i, 1);
            updateInjectorTable();
        });
        const values = Object.values(injectors[i]);
        for (let i = 0; i < values.length; i++) {
            const newData = document.createElement('td');
            newData.textContent = values[i];
            newRow.appendChild(newData);
        }
        elements.visuals.injectorTableBody.appendChild(newRow);
    }
}

/**
 * Resets everything.
 */
function resetAll() {
    resetInjectors();
    resetInjectorInputs();
    resetOrderInputs();
    updateInjectorTable();
    updateExportCombo();
}

/**
 * Resets the order inputs.
 */
function resetOrderInputs() {
    Object.values(elements.inputs.order).forEach(input => input.value = '');
}

function resetInjectors() {
    injectors.splice(0, injectors.length);
}

async function updateExportCombo() {
    try {
        const { data } = await axios.get('/api/processes');
        const { processes } = data;

        // Creates an array of options from each process in the list.
        const options = processes.map(process => {
            const newOption = document.createElement('option');
            newOption.textContent = `${process.process_id}: ${process.make}, ${process.part}, ${process.customer}, ${new Date(process.datetime).toLocaleString()}`;
            newOption.value = process.process_id;
            return newOption;
        });

        // Clears the previous options, if there are any.
        elements.inputs.order.process.innerHTML = '';

        // Adds the options to the process selector.
        elements.inputs.order.process.append(...options);
    } catch (err) {
        console.log(err.stack);
        window.alert(err.message);
    }
}

function addInputValidations() {
    const filterLetters = function () { this.value = this.value.replace(/[^0-9]/g, '') };
    const { inputs } = elements;
    Object.values(inputs.injector).forEach(input => input.addEventListener('input', filterLetters));
    elements.inputs.order.ohm.addEventListener('input', filterLetters);
}

main();