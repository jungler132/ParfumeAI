import React, { useState } from 'react';
import { Button, Image, View, Text, Alert, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import axios from 'axios';
import uuid from 'react-native-uuid';
import RNEventSource from 'react-native-event-source';

const App = () => {
  const [imageUri, setImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [option, setOption] = useState('recommendation');

  const selectImage = () => {
    launchImageLibrary({ mediaType: 'photo' }, (response) => {
      if (response.assets && response.assets.length > 0) {
        setImageUri(response.assets[0].uri);
      }
    });
  };

  const runPayload = async (filepath) => {
    const link = "api.fashtechai.com";
    const sessionHash = uuid.v4().slice(0, 11);
    const uploadUrl = `https://${link}/upload?upload_id=${sessionHash}`;
    const joinUrl = `https://${link}/queue/join`;
    const dataUrl = `https://${link}/queue/data?session_hash=${sessionHash}`;

    try {
      const response = await fetch(filepath);
      const blob = await response.blob();
      const filename = filepath.split('/').pop();
      const fileSize = blob.size;

      const formData = new FormData();
      formData.append('files', {
        uri: filepath,
        name: filename,
        type: blob.type || 'application/octet-stream'
      });

      const fileResponse = await axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileServerPath = fileResponse.data[0];
      console.log("File uploaded");

      const payload = {
        data: [
          {
            path: fileServerPath,
            url: `https://${link}/file=${fileServerPath}`,
            orig_name: filename,
            size: fileSize,
            mime_type: blob.type
          },
          option
        ],
        event_data: null,
        fn_index: 0,
        trigger_id: 10,
        session_hash: sessionHash
      };

      await axios.post(joinUrl, payload);

      const eventSource = new RNEventSource(dataUrl);

      eventSource.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        console.log(data);

        switch (data.msg) {
          case 'log':
            setStatusMessage(`${data.level}: ${data.log}`);
            break;
          case 'process_starts':
            setStatusMessage('Process started...');
            break;
          case 'queue_full':
            setStatusMessage('Queue is full, please wait...');
            break;
          case 'progress':
            setStatusMessage(`Progress: ${data.progress}%`);
            break;
          case 'heartbeat':
            setStatusMessage('Server is active...');
            break;
          case 'process_completed':
            if (!data.success) {
              setStatusMessage('Processing error.');
            } else {
              setLoading(false);
              setStatusMessage('Process completed successfully!');
              setResult(data.output.data[0]);
            }
            eventSource.close();
            break;
          case 'close_stream':
            eventSource.close();
            break;
          default:
            break;
        }
      });

      eventSource.onerror = (error) => {
        console.error('Stream error', error);
        setStatusMessage('Stream error.');
        eventSource.close();
      };
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  };

  const sendImage = async () => {
    if (!imageUri) return;

    setLoading(true);
    setStatusMessage('Uploading image...');

    try {
      await runPayload(imageUri);
    } catch (error) {
      console.log('error --->', error);
      Alert.alert('Error', `Error uploading image: ${error.message}`);
    } finally {
     //
    }
  };

  const RecommendationView = () => (
    <View style={styles.resultContainer}>
      {result && (
        <>
          <Text style={styles.analysisText}>
            {result.analysis ? result.analysis.replace(/\n/g, '\n') : ''}
          </Text>
          {result.data && Array.isArray(result.data) ? (
            result.data.map((item, index) => (
              <View key={index} style={styles.resultItem}>
                <Image source={{ uri: item.image }} style={styles.resultImage} />
                <Text style={styles.resultCaption}>
                  {item.caption ? item.caption.replace(/\n/g, '\n') : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.resultCaption}>No data.</Text>
          )}
        </>
      )}
    </View>
  );

  const CreationView = () => {
    if (!result) {
      return null;
    }
  
    let imageUri = null;
    if (Array.isArray(result.image)) {
      imageUri = result.image[0];
    } else {
      imageUri = result.image;
    }
  
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.analysisText}>Perfume Creation Details:</Text>
        <Text style={styles.resultCaption}>
          {result.caption ? result.caption.replace(/\n/g, '\n') : ''}
        </Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.resultImage} />
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Perfume</Text>

      <View style={styles.optionContainer}>
        <View style={styles.optionsRow}>
          <TouchableOpacity style={[styles.optionButton, option === 'recommendation' && styles.optionButtonSelected]} onPress={() => setOption('recommendation')}>
            <Text style={styles.optionButtonText}>Recommendation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionButton, option === 'creation' && styles.optionButtonSelected]} onPress={() => setOption('creation')}>
            <Text style={styles.optionButtonText}>Creation</Text>
          </TouchableOpacity>
        </View>
      </View>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
      {!imageUri && <Text style={styles.placeholderText}>Select an image</Text>}

      <TouchableOpacity style={styles.button} onPress={selectImage}>
        <Text style={styles.buttonText}>Gallery</Text>
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={sendImage}>
          <Text style={styles.buttonText}>Send Image</Text>
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator size="large" color="#007BFF" />}
      {statusMessage && <Text style={styles.statusMessage}>{statusMessage}</Text>}

      {option === 'recommendation' && <RecommendationView />}
      {option === 'creation' && <CreationView />}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  optionContainer: {
    marginBottom: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    padding: 10,
    backgroundColor: '#ddd',
    borderRadius: 10,
    marginHorizontal: 5,
  },
  optionButtonSelected: {
    backgroundColor: '#007BFF',
  },
  optionButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  placeholderText: {
    fontSize: 18,
    color: '#888',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    width: '100%',
    marginTop: 20,
  },
  resultItem: {
    marginBottom: 20,
    alignItems: 'center',
  },
  resultImage: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf:'center',
    marginVertical:20
  },
  resultCaption: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 10,
    color: '#333',
  },
  analysisText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#555',
  },
  statusMessage: {
    fontSize: 16,
    marginVertical: 10,
    color: '#007BFF',
  },
});

export default App;
