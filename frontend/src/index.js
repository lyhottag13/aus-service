import elements from './utils/elements.js';
import axios from 'axios';

const injectors = []; // Holds all the injectors in the order.

async function main() {
    elements.buttons.submit.addEventListener('click', handleSubmit);
    elements.buttons.add.addEventListener('click', handleAdd);
    elements.buttons.export.addEventListener('click', handleExport);
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
        if (elements.inputs.customer.value === '' || elements.inputs.part.value === '' || elements.inputs.ohm.value === '' || elements.inputs.make.value === '') {
            return window.alert('Fill out all the service fields');
        }
        const response = await axios.post('/api/service', {
            injectors,
            make: elements.inputs.make.value,
            part: elements.inputs.part.value,
            customer: elements.inputs.customer.value,
            ohm: elements.inputs.ohm.value
        });
        window.alert('Cool :)');
        updateInjectorTable();
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
        injectorSerial: elements.inputs.injectorSerial.value,
        duty100Before: elements.inputs.duty100Before.value,
        duty100After: elements.inputs.duty100After.value,
        duty50Before: elements.inputs.duty50Before.value,
        duty50After: elements.inputs.duty50After.value,
        idleBefore: elements.inputs.idleBefore.value,
        idleAfter: elements.inputs.idleAfter.value,
    };
    injectors.push(newInjector);
    resetInjectorInputs();
    updateInjectorTable();
}

async function handleExport() {
    try {
        const processId = window.prompt('Process ID?');
        if (!processId || isNaN(processId)) {
            return;
        }
        window.open(`/api/export?processId=${processId}`);
    } catch (err) {
        
    }
}

/**
 * Resets all the injector inputs.
 */
function resetInjectorInputs() {
    elements.inputs.injectorSerial.value = '';
    elements.inputs.duty100Before.value = '';
    elements.inputs.duty100After.value = '';
    elements.inputs.duty50Before.value = '';
    elements.inputs.duty50After.value = '';
    elements.inputs.idleBefore.value = '';
    elements.inputs.idleAfter.value = '';



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
    resetInjectorInputs();
    resetOrderInputs();
}

/**
 * Resets the order inputs.
 */
function resetOrderInputs() {
    elements.inputs.customer.value = '';
    elements.inputs.make.value = '';
    elements.inputs.part.value = '';
    elements.inputs.ohm.value = '';
}

main();